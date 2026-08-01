---
title: Custom transports & DISPLAY protocols
sidebar_position: 5
---

# Custom transports & DISPLAY protocols

Out of the box, node-x11 connects over a unix socket or TCP. But the client
core only needs a duplex stream, and the connection layer is pluggable: you
can register your own DISPLAY protocol or hand `createClient` an
already-open stream. This is what makes it possible to run node-x11 in a
browser, tunnel X over WebSockets or a message channel, or test against an
in-process fake server.

## The display string syntax

Display strings follow the standard X form, with an optional protocol
prefix:

```
proto/host:display.screen
```

`x11.parseDisplay(display)` exposes the parser; it returns
`{ display, protocol, host, displayNum, screenNum }`:

```js
x11.parseDisplay(':0');
// { protocol: '', host: '', displayNum: '0', screenNum: 0 }

x11.parseDisplay('tcp/somehost:1.2');
// { protocol: 'tcp', host: 'somehost', displayNum: '1', screenNum: '2' }

x11.parseDisplay('ws/example.org:3');
// { protocol: 'ws', host: 'example.org', displayNum: '3', screenNum: 0 }
```

The built-in protocol names `unix`, `local`, `tcp`, `inet` and `inet6`
force the corresponding standard transport. Any other prefix is looked up
in the custom protocol registry. macOS launchd socket paths
(`/private/tmp/...:0`) are recognised and kept whole as the host.

## registerDisplayProtocol(name, connect)

Register a connection handler for a protocol prefix:

```js
const x11 = require('x11');

x11.registerDisplayProtocol('ws', (params, options) => {
  // params: { display, protocol, host, displayNum, screenNum }
  // options: the options object passed to createClient
  const stream = makeWebSocketDuplexSomehow(params.host, params.displayNum);
  return stream;
});

x11.createClient({ display: 'ws/example.org:0' }, (err, display) => {
  // speaks X11 over your transport
});
```

The `connect` function receives the parsed display and the `createClient`
options, and must return a duplex-stream-like object — anything with
`write(buf)` / `end()` and `'data'` / `'end'` / `'error'` events. If the
stream is not immediately usable, follow `net.Socket` semantics: set
`connecting = true` and emit `'connect'` once ready. A stream that is
already open is used as-is.

`write(buf)` must consume or copy `buf` before it returns, unless it is a
real `stream.Writable` (one with a numeric `writableLength`, whose
`write(buf, cb)` callback says when the buffer is free). The client packs
requests into a buffer it reuses, so a transport that keeps the object
around — queueing it for a later send, say — must take its own copy, the way
`MessagePortStream` does.

Connecting with an unregistered protocol prefix throws
`unknown display protocol: <name>`.

## options.stream

If you already hold an open duplex stream, skip the registry and inject it
directly:

```js
x11.createClient({ display: ':9', stream: myDuplexStream }, (err, display) => {
  // handshake happens over myDuplexStream; ':9' only provides
  // displayNum/screenNum for the client object
});
```

The display string is still parsed (for `displayNum` and `screenNum`) but
no socket is opened.

## options.auth

Custom transports and injected streams have no `~/.Xauthority` file to
consult, so by default they perform an *empty* auth handshake
(`{ name: '', data: '' }`). If your server expects a cookie, pass it
explicitly:

```js
x11.createClient({
  display: 'ws/example.org:0',
  auth: { name: 'MIT-MAGIC-COOKIE-1', data: cookieBuffer },
}, callback);
```

For the built-in unix/TCP transports, `options.auth` overrides the
Xauthority lookup in the same way.

## Testing without an X server

This mechanism is exercised end-to-end in `test/display-protocols.js`,
which connects a client to a tiny in-process fake X server through an
in-memory stream pair — a useful template if you want to unit-test code
that talks to X without spawning Xvfb.

## In the browser

The [playground](/playground) on this site is built entirely on this
mechanism: the page boots the pure-JS X server from `lib/xserver`, registers
a `demo` display protocol whose `connect` returns an in-memory stream pair
wired to that server, and sets `process.env.DISPLAY = 'demo/local:0'`. The
demo code you edit there is ordinary node-x11 client code — unchanged, it
would run against a real display in node:

```js
x11.registerDisplayProtocol('demo', () => serverConnectedStreamPair());
process.env.DISPLAY = 'demo/local:0';

// from here on, exactly like node:
x11.createClient((err, display) => { /* ... */ });
```
