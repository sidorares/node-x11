# SYNC extension

Server-side synchronization primitives: 64-bit counters that clients can
create, change and wait on, alarms that fire events when a counter crosses a
threshold, client scheduling priorities, and (since 3.1) fences bound to a
drawable's rendering.

- Module: `X.require('sync', cb)` (X name `SYNC`, version 3.1)
- Source: [`lib/ext/sync.js`](../../lib/ext/sync.js) ·
  Tests: [`test/sync.js`](../../test/sync.js)
- Spec: [sync.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/sync.txt)

```js
X.require('sync', (err, Sync) => {
    const counter = X.AllocID();
    Sync.CreateCounter(counter, 100);
    Sync.QueryCounter(counter, (err, value) => {
        // value === 100
    });
    const alarm = X.AllocID();
    Sync.CreateAlarm(alarm, {
        counter,
        valueType: Sync.ValueType.Absolute,
        value: 1000,
        testType: Sync.TestType.PositiveComparison,
        delta: 1,
        events: 1
    });
    X.on('event', ev => {
        // AlarmNotify fires when the counter reaches 1000
    });
});
```

`Initialize` is issued automatically while requiring (the protocol demands it
before any other SYNC request); the negotiated version is available as
`Sync.major` / `Sync.minor`.

All counter, alarm-value and delta arguments are plain JS numbers. On the wire
they are INT64; see [Notes](#notes) for the precision caveat.

## Requests

### Initialize(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])`. Called
automatically by `X.require` with 3.1.

### ListSystemCounters(cb)
`cb(err, counters)` — array of `{counter, resolution, name}`: the counter
XID, its resolution (a number) and its ASCII name. Every server provides at
least `SERVERTIME`.

### CreateCounter(id, initialValue)
Creates a counter with a fresh XID `id` (from `X.AllocID()`) holding
`initialValue`. No reply.

### SetCounter(counter, value)
Sets the counter to `value` (may be negative). No reply.

### ChangeCounter(counter, amount)
Adds `amount` (may be negative) to the counter. No reply.

### QueryCounter(counter, cb)
`cb(err, value)` — the counter's current value as a number.

### DestroyCounter(counter)
Destroys the counter; pending Awaits on it are released and triggered alarms
on it become Inactive. No reply.

### Await(waitList)
`waitList` is an array of wait conditions:
`{counter, valueType, value, testType, eventThreshold}` (omitted fields
default to 0). The server stops processing further requests from this
connection until at least one condition is satisfied — replies to requests
sent after `Await` only arrive once it unblocks. If the counter jumps past
`value` by more than `eventThreshold`, a `CounterNotify` event is sent.
No reply.

### CreateAlarm(id, values)
Creates alarm `id` (a fresh XID). `values` is a value-mask style object with
any of `{counter, valueType, value, testType, delta, events}`; omitted
attributes keep server defaults. When the trigger condition on `counter`
becomes true the alarm sends `AlarmNotify` (if `events` is set) and re-arms
itself by adding `delta` to the trigger value. No reply.

### ChangeAlarm(id, values)
Changes alarm attributes; same `values` object as `CreateAlarm`. No reply.

### QueryAlarm(alarm, cb)
`cb(err, {trigger, delta, events, state})` where `trigger` is
`{counter, waitType, waitValue, testType}`, `events` is a boolean and
`state` is one of `Sync.AlarmState`.

### DestroyAlarm(alarm)
Destroys the alarm. No reply.

### SetPriority(id, priority)
Sets the scheduling priority (INT32, higher runs first) of the client owning
XID `id`; `id = 0` means the requesting client. No reply.

### GetPriority(id, cb)
`cb(err, priority)` — the client's current priority. `id = 0` for the
requesting client.

### CreateFence(drawable, fence, initiallyTriggered)
SYNC 3.1. Creates fence `fence` (a fresh XID) on the screen of `drawable`,
initially triggered when `initiallyTriggered` is truthy. No reply.

### TriggerFence(fence)
Asks the server to set the fence to triggered once all rendering affecting it
has completed. No reply.

### ResetFence(fence)
Puts a triggered fence back into the untriggered state. No reply.

### DestroyFence(fence)
Destroys the fence. No reply.

### QueryFence(fence, cb)
`cb(err, triggered)` — boolean, current fence state.

### AwaitFence(fenceList)
`fenceList` is an array of fence XIDs. Like `Await`, blocks further request
processing for this connection until every listed fence is triggered.
No reply.

## Events / errors

### CounterNotify
Sent when an `Await` condition is satisfied with the counter overshooting the
awaited value by more than the condition's `eventThreshold`, or when an
awaited counter is destroyed. Fields:
`{type, seq, name: 'CounterNotify', kind, counter, waitValue, counterValue,
time, count, destroyed}` — `count` is the number of further CounterNotify
events following this one, `destroyed` is a boolean.

### AlarmNotify
Sent when an alarm with `events` enabled triggers or changes state. Fields:
`{type, seq, name: 'AlarmNotify', kind, alarm, counterValue, alarmValue,
time, state}` — `state` is one of `Sync.AlarmState`.

## Notes

- INT64 precision: counter/alarm values travel as 64-bit integers on the wire
  but are composed into plain JS numbers (no BigInt in the public API).
  Values with magnitude above 2^53 lose precision; everything up to
  ±2^53 - 1 round-trips exactly (verified up to 2^40 in the tests).
- Enums attached to the extension object:
  - `Sync.ValueType = {Absolute: 0, Relative: 1}`
  - `Sync.TestType = {PositiveTransition: 0, NegativeTransition: 1,
    PositiveComparison: 2, NegativeComparison: 3}`
  - `Sync.AlarmState = {Active: 0, Inactive: 1, Destroyed: 2}`
  - `Sync.CA = {Counter: 1, ValueType: 2, Value: 4, TestType: 8, Delta: 16,
    Events: 32}` — the value mask bits; `CreateAlarm`/`ChangeAlarm` build the
    mask automatically from the keys present in `values`, so `CA` is only
    needed for reference.
- Fence requests require SYNC 3.1; check `Sync.minor >= 1` before using them
  (the tests skip fences on older servers).
- `Await`/`AwaitFence` block on the server side only — the Node process keeps
  running; it is the replies on this connection that stall. Use a second
  connection to satisfy the condition (see the Await tests).
