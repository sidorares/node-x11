const x11 = require('../lib');
const should = require('should');

describe('XKEYBOARD extension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.X.require('xkb', (err, ext) => {
                should.not.exist(err);
                self.xkb = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('UseExtension should report a supported 1.x server version', function() {
        this.xkb.supported.should.equal(1);
        this.xkb.serverMajor.should.equal(1);
        this.xkb.serverMinor.should.be.aboveOrEqual(0);
    });

    it('GetState should return group and modifier state of the core keyboard', function(done) {
        this.xkb.GetState(this.xkb.UseCoreKbd, (err, state) => {
            should.not.exist(err);
            state.deviceID.should.be.above(0);
            state.group.should.be.within(0, 3);
            state.lockedGroup.should.be.within(0, 3);
            state.mods.should.be.within(0, 255);
            state.baseMods.should.be.within(0, 255);
            state.latchedMods.should.be.within(0, 255);
            state.lockedMods.should.be.within(0, 255);
            state.ptrBtnState.should.be.a.Number();
            done();
        });
    });

    it('Bell should ring without error', function(done) {
        const self = this;
        const onError = err => done(err);
        this.X.on('error', onError);
        // eventOnly bell: reaches the server, but keeps CI quiet
        this.xkb.Bell(this.xkb.UseCoreKbd, this.xkb.DfltXIClass, this.xkb.DfltXIId,
            0, 0, 1, -1, -1, 0, 0);
        // round trip to make sure any error for the bell has arrived
        this.xkb.GetState(this.xkb.UseCoreKbd, err => {
            self.X.removeListener('error', onError);
            should.not.exist(err);
            done();
        });
    });

    it('LatchLockState should lock a modifier, visible via GetState, then restore', function(done) {
        const self = this;
        const xkb = this.xkb;
        const lockMask = xkb.ModMask.Lock; // caps lock
        xkb.LatchLockState(xkb.UseCoreKbd, lockMask, lockMask, false, 0, 0, 0, false, 0);
        xkb.GetState(xkb.UseCoreKbd, (err, state) => {
            should.not.exist(err);
            (state.lockedMods & lockMask).should.equal(lockMask);
            // restore: other tests share the server's keyboard state
            xkb.LatchLockState(xkb.UseCoreKbd, lockMask, 0, false, 0, 0, 0, false, 0);
            xkb.GetState(xkb.UseCoreKbd, (err, state) => {
                should.not.exist(err);
                (state.lockedMods & lockMask).should.equal(0);
                done();
            });
        });
    });

    it('SelectEvents + eventOnly Bell should deliver an XkbBellNotify event', function(done) {
        const self = this;
        const xkb = this.xkb;
        xkb.SelectEvents(xkb.UseCoreKbd, xkb.EventType.BellNotify, 0,
            xkb.EventType.BellNotify, 0, 0);
        const onEvent = ev => {
            if (ev.name !== 'XkbBellNotify')
                return;
            self.X.removeListener('event', onEvent);
            // deselect again to not disturb later tests
            xkb.SelectEvents(xkb.UseCoreKbd, xkb.EventType.BellNotify,
                xkb.EventType.BellNotify, 0, 0, 0);
            ev.pitch.should.equal(440);
            ev.duration.should.equal(10);
            ev.eventOnly.should.equal(1);
            done();
        };
        this.X.on('event', onEvent);
        xkb.Bell(xkb.UseCoreKbd, xkb.DfltXIClass, xkb.DfltXIId, 50, 0, 1, 440, 10, 0, 0);
    });

    it('GetControls should return the default repeat timings', function(done) {
        this.xkb.GetControls(this.xkb.UseCoreKbd, (err, ctrls) => {
            should.not.exist(err);
            ctrls.numGroups.should.be.aboveOrEqual(1);
            ctrls.repeatDelay.should.be.above(0);
            ctrls.repeatInterval.should.be.above(0);
            ctrls.mouseKeysDfltBtn.should.be.above(0);
            ctrls.perKeyRepeat.length.should.equal(32);
            done();
        });
    });

    it('GetNames should return keycodes/symbols atoms and per-key names', function(done) {
        const self = this;
        const xkb = this.xkb;
        const which = xkb.NameDetail.Keycodes | xkb.NameDetail.Symbols |
            xkb.NameDetail.KeyNames | xkb.NameDetail.GroupNames |
            xkb.NameDetail.VirtualModNames | xkb.NameDetail.IndicatorNames;
        xkb.GetNames(xkb.UseCoreKbd, which, (err, names) => {
            should.not.exist(err);
            names.which.should.equal(which);
            names.minKeyCode.should.be.above(0);
            names.maxKeyCode.should.be.above(names.minKeyCode);
            names.keyNames.length.should.equal(names.nKeys);
            names.keyNames.should.containEql('AE01');
            names.virtualModNames.length.should.be.above(0);
            names.keycodesName.should.be.above(0);
            names.symbolsName.should.be.above(0);
            self.X.GetAtomName(names.keycodesName, (err, keycodesName) => {
                should.not.exist(err);
                keycodesName.length.should.be.above(0);
                done();
            });
        });
    });

    after(function(done) {
        // defensive: make sure no modifier lock leaks to other test files
        this.xkb.LatchLockState(this.xkb.UseCoreKbd, 0xff, 0, false, 0, 0xff, 0, false, 0);
        this.X.terminate();
        this.X.on('end', done);
    });
});
