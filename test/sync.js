const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

describe('SYNC extension', () => {
    let X, root, sync, counter, alarm;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            X.require('sync', (err, ext) => {
                should.not.exist(err);
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
        sync.major.should.equal(3);
        sync.minor.should.be.aboveOrEqual(0);
    });

    it('ListSystemCounters should include SERVERTIME', function(t, done) {
        sync.ListSystemCounters((err, counters) => {
            should.not.exist(err);
            counters.should.be.an.Array();
            const names = counters.map(c => c.name);
            names.should.containEql('SERVERTIME');
            counters.forEach(c => {
                c.counter.should.be.above(0);
                c.resolution.should.be.a.Number();
            });
            done();
        });
    });

    it('CreateCounter with initial value 100 should QueryCounter back 100', function(t, done) {
        counter = X.AllocID();
        sync.CreateCounter(counter, 100);
        sync.QueryCounter(counter, (err, value) => {
            should.not.exist(err);
            value.should.equal(100);
            done();
        });
    });

    it('SetCounter and ChangeCounter should round-trip (incl. 64-bit and negative values)', function(t, done) {
        const big = Math.pow(2, 40) + 7; // needs the hi 32-bit half
        sync.SetCounter(counter, big);
        sync.QueryCounter(counter, (err, value) => {
            should.not.exist(err);
            value.should.equal(big);
            sync.SetCounter(counter, 10);
            sync.ChangeCounter(counter, -25);
            sync.QueryCounter(counter, (err, value2) => {
                should.not.exist(err);
                value2.should.equal(-15);
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
            should.not.exist(err);
            alarm.trigger.counter.should.equal(counter);
            alarm.trigger.waitType.should.equal(sync.ValueType.Absolute);
            alarm.trigger.waitValue.should.equal(1000);
            alarm.trigger.testType.should.equal(sync.TestType.PositiveComparison);
            alarm.delta.should.equal(1);
            alarm.events.should.equal(true);
            alarm.state.should.equal(sync.AlarmState.Active);
            done();
        });
    });

    it('ChangeAlarm should update the trigger value', function(t, done) {
        sync.ChangeAlarm(alarm, { value: 50 });
        sync.QueryAlarm(alarm, (err, alarm) => {
            should.not.exist(err);
            alarm.trigger.waitValue.should.equal(50);
            alarm.trigger.counter.should.equal(counter);
            done();
        });
    });

    it('crossing the alarm threshold should deliver an AlarmNotify event', function(t, done) {
        X.once('event', ev => {
            ev.name.should.equal('AlarmNotify');
            ev.alarm.should.equal(alarm);
            ev.counterValue.should.equal(60);
            ev.state.should.equal(sync.AlarmState.Active);
            done();
        });
        sync.SetCounter(counter, 60); // alarm threshold is 50
    });

    it('Await should block the client until a second connection satisfies the condition', function(t, done) {
        const awaited = X.AllocID();
        sync.CreateCounter(awaited, 0);
        sync.QueryCounter(awaited, (err, value) => {
            should.not.exist(err);
            value.should.equal(0);

            let unblocked = false;
            let gotCounterNotify = false;

            X.once('event', ev => {
                ev.name.should.equal('CounterNotify');
                ev.counter.should.equal(awaited);
                ev.counterValue.should.equal(5);
                ev.destroyed.should.equal(false);
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
                should.not.exist(err);
                unblocked = true;
                value2.should.equal(5);
                gotCounterNotify.should.equal(true);
                sync.DestroyCounter(awaited);
                done();
            });

            setTimeout(() => {
                // still blocked: the QueryCounter reply must not have arrived yet
                unblocked.should.equal(false);
                x11.createClient((err, dpy2) => {
                    should.not.exist(err);
                    const X2 = dpy2.client;
                    X2.require('sync', (err, sync2) => {
                        should.not.exist(err);
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
            should.not.exist(err);
            priority.should.equal(5);
            sync.SetPriority(0, 0);
            sync.GetPriority(0, (err, priority2) => {
                should.not.exist(err);
                priority2.should.equal(0);
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
            should.not.exist(err);
            triggered.should.equal(false);
            sync.TriggerFence(fence);
            sync.QueryFence(fence, (err, triggered2) => {
                should.not.exist(err);
                triggered2.should.equal(true);
                sync.ResetFence(fence);
                sync.QueryFence(fence, (err, triggered3) => {
                    should.not.exist(err);
                    triggered3.should.equal(false);
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
            should.not.exist(err);
            unblocked = true;
            triggered.should.equal(true);
            sync.DestroyFence(fence);
            done();
        });

        setTimeout(() => {
            unblocked.should.equal(false);
            x11.createClient((err, dpy2) => {
                should.not.exist(err);
                const X2 = dpy2.client;
                X2.require('sync', (err, sync2) => {
                    should.not.exist(err);
                    sync2.TriggerFence(fence);
                    setTimeout(() => X2.terminate(), 100);
                });
            });
        }, 200);
    });
});
