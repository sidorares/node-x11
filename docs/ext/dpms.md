# DPMS extension

Display Power Management Signaling: query and control the monitor power
level (On / Standby / Suspend / Off) and the idle timeouts that trigger each
level.

- Module: `X.require('dpms', cb)` (X name `DPMS`, version 1.1)
- Source: [`lib/ext/dpms.js`](../../lib/ext/dpms.js) ·
  Tests: [`test/dpms.js`](../../test/dpms.js)
- Spec: [dpms.txt](http://www.x.org/releases/X11R7.6/doc/xextproto/dpms.txt)

```js
X.require('dpms', (err, dpms) => {
    dpms.GetTimeouts((err, timeouts) => {
        // [standbySeconds, suspendSeconds, offSeconds]
    });
    dpms.Enable();
    dpms.ForceLevel(3); // blank the display (Off)
});
```

All replies are arrays (positional), not objects.

## Requests

### GetVersion(clientMajor, clientMinor, cb)
`cb(err, [major, minor])` — the DPMS version the server implements. Not
called automatically.

### Capable(cb)
`cb(err, [capable])` — `capable` is 1 when the display system supports DPMS,
else 0. Note the single-element array.

### GetTimeouts(cb)
`cb(err, [standby, suspend, off])` — idle timeouts in seconds; 0 disables
the corresponding level.

### SetTimeouts(standby, suspend, off)
Sets the three idle timeouts (seconds, CARD16; 0 disables a level). No
reply. The server requires `standby <= suspend <= off` (ignoring zeros) and
answers BadValue otherwise.

### Enable()
Enables DPMS control of the display, using the current timeout values. No
reply.

### Disable()
Disables DPMS (display stays on regardless of timeouts). No reply.

### ForceLevel(level)
Immediately puts the display into `level`: 0 On, 1 Standby, 2 Suspend,
3 Off. No reply. DPMS must be enabled first, otherwise the server answers
with an error (the test calls `Enable()` before forcing a level).

### Info(cb)
`cb(err, [powerLevel, state])` — current power level (same codes as
`ForceLevel`) and `state` 1 when DPMS is enabled, 0 when disabled.

## Events / errors

None.

## Notes

- Reply unpacking uses the generated decoders in
  [`lib/generated/dpms-replies.js`](../../lib/generated/dpms-replies.js);
  results are re-shaped into the positional arrays above for API
  compatibility.
- No level constants are attached to the extension object; use the numeric
  codes (0 On, 1 Standby, 2 Suspend, 3 Off).
- Some servers are built or started without DPMS (the require callback then
  gets `Error('extension not available')`); the test suite skips itself in
  that case.
