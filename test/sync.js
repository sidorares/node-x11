const x11 = require('../lib');
const should = require('should');

describe('SYNC extension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.X.require('sync', (err, ext) => {
                should.not.exist(err);
                self.sync = ext;
                done();
            });
        });

        client.on('error', done);
    });

    after(function(done) {
        if (this.alarm)
            this.sync.DestroyAlarm(this.alarm);
        if (this.counter)
            this.sync.DestroyCounter(this.counter);
        this.X.terminate();
        this.X.on('end', done);
    });

    it('Initialize should report version 3.x', function() {
        this.sync.major.should.equal(3);
        this.sync.minor.should.be.aboveOrEqual(0);
    });

    it('ListSystemCounters should include SERVERTIME', function(done) {
        this.sync.ListSystemCounters((err, counters) => {
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

    it('CreateCounter with initial value 100 should QueryCounter back 100', function(done) {
        this.counter = this.X.AllocID();
        this.sync.CreateCounter(this.counter, 100);
        this.sync.QueryCounter(this.counter, (err, value) => {
            should.not.exist(err);
            value.should.equal(100);
            done();
        });
    });

    it('SetCounter and ChangeCounter should round-trip (incl. 64-bit and negative values)', function(done) {
        const self = this;
        const big = Math.pow(2, 40) + 7; // needs the hi 32-bit half
        self.sync.SetCounter(self.counter, big);
        self.sync.QueryCounter(self.counter, (err, value) => {
            should.not.exist(err);
            value.should.equal(big);
            self.sync.SetCounter(self.counter, 10);
            self.sync.ChangeCounter(self.counter, -25);
            self.sync.QueryCounter(self.counter, (err, value2) => {
                should.not.exist(err);
                value2.should.equal(-15);
                done();
            });
        });
    });

    it('CreateAlarm and QueryAlarm should round-trip alarm attributes', function(done) {
        const self = this;
        self.sync.SetCounter(self.counter, 0);
        self.alarm = self.X.AllocID();
        self.sync.CreateAlarm(self.alarm, {
            counter: self.counter,
            valueType: self.sync.ValueType.Absolute,
            value: 1000,
            testType: self.sync.TestType.PositiveComparison,
            delta: 1,
            events: 1
        });
        self.sync.QueryAlarm(self.alarm, (err, alarm) => {
            should.not.exist(err);
            alarm.trigger.counter.should.equal(self.counter);
            alarm.trigger.waitType.should.equal(self.sync.ValueType.Absolute);
            alarm.trigger.waitValue.should.equal(1000);
            alarm.trigger.testType.should.equal(self.sync.TestType.PositiveComparison);
            alarm.delta.should.equal(1);
            alarm.events.should.equal(true);
            alarm.state.should.equal(self.sync.AlarmState.Active);
            done();
        });
    });

    it('ChangeAlarm should update the trigger value', function(done) {
        const self = this;
        self.sync.ChangeAlarm(self.alarm, { value: 50 });
        self.sync.QueryAlarm(self.alarm, (err, alarm) => {
            should.not.exist(err);
            alarm.trigger.waitValue.should.equal(50);
            alarm.trigger.counter.should.equal(self.counter);
            done();
        });
    });

    it('crossing the alarm threshold should deliver an AlarmNotify event', function(done) {
        const self = this;
        self.X.once('event', ev => {
            ev.name.should.equal('AlarmNotify');
            ev.alarm.should.equal(self.alarm);
            ev.counterValue.should.equal(60);
            ev.state.should.equal(self.sync.AlarmState.Active);
            done();
        });
        self.sync.SetCounter(self.counter, 60); // alarm threshold is 50
    });

    it('Await should block the client until a second connection satisfies the condition', function(done) {
        const self = this;
        const awaited = self.X.AllocID();
        self.sync.CreateCounter(awaited, 0);
        self.sync.QueryCounter(awaited, (err, value) => {
            should.not.exist(err);
            value.should.equal(0);

            let unblocked = false;
            let gotCounterNotify = false;

            self.X.once('event', ev => {
                ev.name.should.equal('CounterNotify');
                ev.counter.should.equal(awaited);
                ev.counterValue.should.equal(5);
                ev.destroyed.should.equal(false);
                gotCounterNotify = true;
            });

            self.sync.Await([{
                counter: awaited,
                valueType: self.sync.ValueType.Absolute,
                value: 5,
                testType: self.sync.TestType.PositiveComparison,
                eventThreshold: 0
            }]);

            // this reply can only arrive once the Await condition is met
            self.sync.QueryCounter(awaited, (err, value2) => {
                should.not.exist(err);
                unblocked = true;
                value2.should.equal(5);
                gotCounterNotify.should.equal(true);
                self.sync.DestroyCounter(awaited);
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

    it('SetPriority and GetPriority should round-trip on own client', function(done) {
        const self = this;
        self.sync.SetPriority(0, 5); // 0 = the requesting client
        self.sync.GetPriority(0, (err, priority) => {
            should.not.exist(err);
            priority.should.equal(5);
            self.sync.SetPriority(0, 0);
            self.sync.GetPriority(0, (err, priority2) => {
                should.not.exist(err);
                priority2.should.equal(0);
                done();
            });
        });
    });

    it('fences should create, trigger, reset and query', function(done) {
        const self = this;
        if (self.sync.minor < 1) {
            // fences were added in SYNC 3.1
            return this.skip();
        }
        const fence = self.X.AllocID();
        self.sync.CreateFence(self.root, fence, false);
        self.sync.QueryFence(fence, (err, triggered) => {
            should.not.exist(err);
            triggered.should.equal(false);
            self.sync.TriggerFence(fence);
            self.sync.QueryFence(fence, (err, triggered2) => {
                should.not.exist(err);
                triggered2.should.equal(true);
                self.sync.ResetFence(fence);
                self.sync.QueryFence(fence, (err, triggered3) => {
                    should.not.exist(err);
                    triggered3.should.equal(false);
                    self.sync.DestroyFence(fence);
                    done();
                });
            });
        });
    });

    it('AwaitFence should block until a second connection triggers the fence', function(done) {
        const self = this;
        if (self.sync.minor < 1) {
            return this.skip();
        }
        const fence = self.X.AllocID();
        self.sync.CreateFence(self.root, fence, false);

        let unblocked = false;
        self.sync.AwaitFence([fence]);
        self.sync.QueryFence(fence, (err, triggered) => {
            should.not.exist(err);
            unblocked = true;
            triggered.should.equal(true);
            self.sync.DestroyFence(fence);
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
