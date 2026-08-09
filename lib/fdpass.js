'use strict';

// Pure-Node file-descriptor passing for local X connections.
//
// MIT-SHM 1.2 (ShmAttachFd) hands the server a file descriptor for a shared
// segment. That descriptor travels as `SCM_RIGHTS` ancillary data on the unix
// socket — something a plain `net.Socket` cannot emit. Node's public API has
// no way to do it, but the internal `pipe_wrap`/`stream_wrap` bindings reach
// `uv_write2`, which does. This module is the whole and only place that touches
// those bindings, so the rest of the library stays on public API.
//
// The bindings are on Node's `processBindingAllowList`, so `process.binding`
// works for them without flags. It is still DEP0111 and unavailable under
// `--permission`; every entry point here is wrapped so an unsupported runtime
// degrades to "no shared memory" (the caller falls back to a plain socket and
// core PutImage) rather than throwing out of connection setup.
//
// SEND ONLY. Never wire the reverse direction (receiving an fd, i.e. MIT-SHM
// ShmCreateSegment or DRI3 Open/BufferFromPixmap): a regular-file fd arriving
// on a libuv-read socket aborts the process with SIGABRT. See
// ~/NODE_BUG_ANDREY_TO_FIX.md and the notes in lib/ext/shm.js, lib/ext/dri3.js.
//
// One send primitive: sendFds(req, fds, cb). The descriptors are CONSUMED —
// handed to libuv and closed once written, success or not. That is the only
// ownership model that works for every descriptor kind (dma-bufs are
// anonymous inodes that procfs cannot reopen, so no pure-JS dup exists), and
// it matches how they are produced: gbm_bo_get_fd() returns a fresh fd whose
// only purpose is this send. A caller that wants to keep its descriptor dups
// it first (regular files/memfds reopen via /proc/self/fd — see MIT-SHM
// AttachFd in lib/ext/shm.js).
//
// Extensions do not call sendFds directly; they queue the request with
// pack_stream.putWithFds(buf, fds) so the bytes keep their place in the
// output queue (lib/framebuffer.js) and sequence numbers stay honest.

let bindings = null;      // { Pipe, PipeConnectWrap, WriteWrap, PipeConstants }
let bindingsProbed = false;

function loadBindings() {
    if (bindingsProbed)
        return bindings;
    bindingsProbed = true;
    try {
        // process.binding is DEP0111 but these two are on Node's
        // processBindingAllowList, so this works without flags; guarded anyway.
        const pipeWrap = process.binding('pipe_wrap');
        const streamWrap = process.binding('stream_wrap');
        if (!pipeWrap || !pipeWrap.Pipe || !pipeWrap.PipeConnectWrap ||
            !streamWrap || !streamWrap.WriteWrap)
            return (bindings = null);
        bindings = {
            Pipe: pipeWrap.Pipe,
            PipeConnectWrap: pipeWrap.PipeConnectWrap,
            PipeConstants: pipeWrap.constants,
            WriteWrap: streamWrap.WriteWrap
        };
    } catch {
        bindings = null; // hardened runtime, browser bundle, future removal
    }
    return bindings;
}

// Whether this runtime can pass file descriptors. Cheap and memoised.
function available() {
    return loadBindings() !== null;
}

// Attach a `sendFds(reqBuffer, fds, cb)` method to a connected fd-capable
// socket (ownership contract: see file header).
function attachSender(socket, b) {
    const fs = require('fs');
    socket._fdCapable = true;

    // One chunk of request bytes with one descriptor as ancillary data.
    // `ownedFd` is consumed: it is closed when the write completes, fails to
    // queue, or cannot be wrapped. cb(err|null) exactly once.
    const writeChunk = (chunk, ownedFd, cb) => {
        const handle = socket._handle;
        if (!handle || typeof handle.writeBuffer !== 'function') {
            try { fs.closeSync(ownedFd); } catch { /* ignore */ }
            cb(new Error('connection is not fd-capable or already closed'));
            return;
        }
        const carrier = new b.Pipe(b.PipeConstants.SOCKET);
        if (carrier.open(ownedFd) !== 0) {
            try { fs.closeSync(ownedFd); } catch { /* ignore */ }
            cb(new Error('could not wrap descriptor for passing'));
            return;
        }
        const wr = new b.WriteWrap();
        wr.handle = handle;
        wr.oncomplete = status => {
            carrier.close(); // closes ownedFd
            cb(status ? new Error(`fd write failed (uv ${status})`) : null);
        };
        const rc = handle.writeBuffer(wr, chunk, carrier);
        if (rc !== 0) {
            carrier.close();
            cb(new Error(`fd write could not be queued (uv ${rc})`));
        }
    };

    // The descriptors in `fds` are consumed (closed after the write) whether
    // the write succeeds or not. libuv attaches exactly one descriptor per
    // write (uv_write2), so a request carrying N > 1 fds is split into N
    // back-to-back chunks on the same handle. That is invisible to the X
    // server: descriptors are associated with requests by arrival order on
    // the byte stream, not by message boundary (the server queues incoming
    // fds and pops as many as the request being executed declares).
    socket.sendFds = function sendFds(reqBuffer, fds, cb) {
        const n = fds.length;
        if (n === 0) {
            if (cb) process.nextTick(() => cb(new Error('sendFds: no descriptors given')));
            return;
        }
        if (reqBuffer.length < n) {
            fds.forEach(fd => { try { fs.closeSync(fd); } catch { /* ignore */ } });
            if (cb) process.nextTick(() => cb(new Error('sendFds: request too short to chunk')));
            return;
        }
        let firstErr = null;
        let pending = n;
        const done = err => {
            if (err && !firstErr) firstErr = err;
            if (--pending === 0 && cb) cb(firstErr);
        };
        // A failed queueing leaves the connection poisoned like any failed
        // write on the X socket would; later chunks then fail the same way.
        const headLen = reqBuffer.length - (n - 1);
        for (let i = 0; i < n; i++) {
            const chunk = i === 0 ? reqBuffer.subarray(0, headLen)
                : reqBuffer.subarray(headLen + i - 1, headLen + i);
            writeChunk(chunk, fds[i], done);
        }
    };
}

// Connect to `socketPath` over an IPC-mode pipe wrapped in a normal
// `net.Socket`. The socket behaves like any other unix-socket connection but
// its single underlying handle can carry descriptors, so there is exactly one
// owner of the connection fd (no double-close hazard on teardown).
//
// Returns the socket synchronously, "connecting": it emits 'connect' on
// success and 'error' on failure, matching net.createConnection so the caller
// can treat it identically. Returns null if fd passing is unavailable, so the
// caller falls back to net.createConnection.
function connect(socketPath) {
    const b = loadBindings();
    if (!b)
        return null;
    let socket;
    try {
        const net = require('net');
        const pipe = new b.Pipe(b.PipeConstants.IPC);
        // pauseOnCreate: the handle is not connected yet, and a reading Socket
        // over an unconnected handle throws ENOTCONN. It is resumed in the
        // connect callback above.
        socket = new net.Socket({ handle: pipe, pauseOnCreate: true, readable: true, writable: true });
        const req = new b.PipeConnectWrap();
        req.address = socketPath;
        req.oncomplete = status => {
            if (status !== 0) {
                const err = new Error(`connect to ${socketPath} failed (uv ${status})`);
                // surface ENOENT so the caller keeps its unix->TCP fallback
                err.code = status === -2 ? 'ENOENT' : `UV_${-status}`;
                socket.emit('error', err);
                return;
            }
            // The socket was created paused (see below) to keep the constructor
            // from reading an unconnected handle; undo that now, before any
            // 'data' consumer is attached, so it reads like an ordinary socket.
            socket.resume();
            attachSender(socket, b);
            socket.emit('connect');
        };
        const rc = pipe.connect(req, socketPath, req.oncomplete);
        if (rc) {
            const err = new Error(`connect to ${socketPath} failed (uv ${rc})`);
            err.code = 'ENOENT';
            process.nextTick(() => socket.emit('error', err));
        }
    } catch {
        return null; // any surprise -> caller uses a plain socket
    }
    return socket;
}

module.exports = { available, connect };
