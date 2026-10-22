const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('SYNC extension', () => {
    let X, root, sync, counter, alarm;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            X.require('sync', (err, ext) => {
                assert.ifError(err);
                sync = ext;
                done();
            });
        });

        client.on('error', done);
    });

    after(function(t, done) {
        if (alarm)
            sync.DestroyAlarm(alarm);
        if (counter)
            sync.DestroyCounter(counter);
        X.terminate();
        X.on('end', done);
    });

    it('Initialize should report version 3.x', function() {
        assert.strictEqual(sync.major, 3);
        assert.ok(sync.minor >= 0);
    });

    it('ListSystemCounters should include SERVERTIME', function(t, done) {
        sync.ListSystemCounters((err, counters) => {
            assert.ifError(err);
            assert.ok(Array.isArray(counters));
            const names = counters.map(c => c.name);
            assert.ok(names.includes('SERVERTIME'));
            counters.forEach(c => {
                assert.ok(c.counter > 0);
                assert.strictEqual(typeof c.resolution, 'number');
            });
            done();
        });
    });

    it('CreateCounter with initial value 100 should QueryCounter back 100', function(t, done) {
        counter = X.AllocID();
        sync.CreateCounter(counter, 100);
        sync.QueryCounter(counter, (err, value) => {
            assert.ifError(err);
            assert.strictEqual(value, 100);
            done();
        });
    });

    it('SetCounter and ChangeCounter should round-trip (incl. 64-bit and negative values)', function(t, done) {
        const big = Math.pow(2, 40) + 7; // needs the hi 32-bit half
        sync.SetCounter(counter, big);
        sync.QueryCounter(counter, (err, value) => {
            assert.ifError(err);
            assert.strictEqual(value, big);
            sync.SetCounter(counter, 10);
            sync.ChangeCounter(counter, -25);
            sync.QueryCounter(counter, (err, value2) => {
                assert.ifError(err);
                assert.strictEqual(value2, -15);
                done();
            });
        });
    });

    it('CreateAlarm and QueryAlarm should round-trip alarm attributes', function(t, done) {
        sync.SetCounter(counter, 0);
        alarm = X.AllocID();
        sync.CreateAlarm(alarm, {
            counter: counter,
            valueType: sync.ValueType.Absolute,
            value: 1000,
            testType: sync.TestType.PositiveComparison,
            delta: 1,
            events: 1
        });
        sync.QueryAlarm(alarm, (err, alarm) => {
            assert.ifError(err);
            assert.strictEqual(alarm.trigger.counter, counter);
            assert.strictEqual(alarm.trigger.waitType, sync.ValueType.Absolute);
            assert.strictEqual(alarm.trigger.waitValue, 1000);
            assert.strictEqual(alarm.trigger.testType, sync.TestType.PositiveComparison);
            assert.strictEqual(alarm.delta, 1);
            assert.strictEqual(alarm.events, true);
            assert.strictEqual(alarm.state, sync.AlarmState.Active);
            done();
        });
    });

    it('ChangeAlarm should update the trigger value', function(t, done) {
        sync.ChangeAlarm(alarm, { value: 50 });
        sync.QueryAlarm(alarm, (err, alarm) => {
            assert.ifError(err);
            assert.strictEqual(alarm.trigger.waitValue, 50);
            assert.strictEqual(alarm.trigger.counter, counter);
            done();
        });
    });

    it('crossing the alarm threshold should deliver an AlarmNotify event', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.name, 'AlarmNotify');
            assert.strictEqual(ev.alarm, alarm);
            assert.strictEqual(ev.counterValue, 60);
            assert.strictEqual(ev.state, sync.AlarmState.Active);
            done();
        });
        sync.SetCounter(counter, 60); // alarm threshold is 50
    });

    it('Await should block the client until a second connection satisfies the condition', function(t, done) {
        const awaited = X.AllocID();
        sync.CreateCounter(awaited, 0);
        sync.QueryCounter(awaited, (err, value) => {
            assert.ifError(err);
            assert.strictEqual(value, 0);

            let unblocked = false;
            let gotCounterNotify = false;

            X.once('event', ev => {
                assert.strictEqual(ev.name, 'CounterNotify');
                assert.strictEqual(ev.counter, awaited);
                assert.strictEqual(ev.counterValue, 5);
                assert.strictEqual(ev.destroyed, false);
                gotCounterNotify = true;
            });

            sync.Await([{
                counter: awaited,
                valueType: sync.ValueType.Absolute,
                value: 5,
                testType: sync.TestType.PositiveComparison,
                eventThreshold: 0
            }]);

            // this reply can only arrive once the Await condition is met
            sync.QueryCounter(awaited, (err, value2) => {
                assert.ifError(err);
                unblocked = true;
                assert.strictEqual(value2, 5);
                assert.strictEqual(gotCounterNotify, true);
                sync.DestroyCounter(awaited);
                done();
            });

            setTimeout(() => {
                // still blocked: the QueryCounter reply must not have arrived yet
                assert.strictEqual(unblocked, false);
                x11.createClient((err, dpy2) => {
                    assert.ifError(err);
                    const X2 = dpy2.client;
                    X2.require('sync', (err, sync2) => {
                        assert.ifError(err);
                        sync2.SetCounter(awaited, 5); // unblocks the first client
                        X2.on('event', () => {}); // ignore
                        setTimeout(() => X2.terminate(), 100);
                    });
                });
            }, 200);
        });
    });

    it('SetPriority and GetPriority should round-trip on own client', function(t, done) {
        sync.SetPriority(0, 5); // 0 = the requesting client
        sync.GetPriority(0, (err, priority) => {
            assert.ifError(err);
            assert.strictEqual(priority, 5);
            sync.SetPriority(0, 0);
            sync.GetPriority(0, (err, priority2) => {
                assert.ifError(err);
                assert.strictEqual(priority2, 0);
                done();
            });
        });
    });

    it('fences should create, trigger, reset and query', function(t, done) {
        if (sync.minor < 1) {
            // fences were added in SYNC 3.1
            t.skip();
            return done();
        }
        const fence = X.AllocID();
        sync.CreateFence(root, fence, false);
        sync.QueryFence(fence, (err, triggered) => {
            assert.ifError(err);
            assert.strictEqual(triggered, false);
            sync.TriggerFence(fence);
            sync.QueryFence(fence, (err, triggered2) => {
                assert.ifError(err);
                assert.strictEqual(triggered2, true);
                sync.ResetFence(fence);
                sync.QueryFence(fence, (err, triggered3) => {
                    assert.ifError(err);
                    assert.strictEqual(triggered3, false);
                    sync.DestroyFence(fence);
                    done();
                });
            });
        });
    });

    it('AwaitFence should block until a second connection triggers the fence', function(t, done) {
        if (sync.minor < 1) {
            t.skip();
            return done();
        }
        const fence = X.AllocID();
        sync.CreateFence(root, fence, false);

        let unblocked = false;
        sync.AwaitFence([fence]);
        sync.QueryFence(fence, (err, triggered) => {
            assert.ifError(err);
            unblocked = true;
            assert.strictEqual(triggered, true);
            sync.DestroyFence(fence);
            done();
        });

        setTimeout(() => {
            assert.strictEqual(unblocked, false);
            x11.createClient((err, dpy2) => {
                assert.ifError(err);
                const X2 = dpy2.client;
                X2.require('sync', (err, sync2) => {
                    assert.ifError(err);
                    sync2.TriggerFence(fence);
                    setTimeout(() => X2.terminate(), 100);
                });
            });
        }, 200);
    });
});
