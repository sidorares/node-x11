const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

describe('XKEYBOARD extension', () => {
    let X, xkb;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            X.require('xkb', (err, ext) => {
                should.not.exist(err);
                xkb = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('UseExtension should report a supported 1.x server version', function() {
        xkb.supported.should.equal(1);
        xkb.serverMajor.should.equal(1);
        xkb.serverMinor.should.be.aboveOrEqual(0);
    });

    it('GetState should return group and modifier state of the core keyboard', function(t, done) {
        xkb.GetState(xkb.UseCoreKbd, (err, state) => {
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

    it('Bell should ring without error', function(t, done) {
        const onError = err => done(err);
        X.on('error', onError);
        // eventOnly bell: reaches the server, but keeps CI quiet
        xkb.Bell(xkb.UseCoreKbd, xkb.DfltXIClass, xkb.DfltXIId,
            0, 0, 1, -1, -1, 0, 0);
        // round trip to make sure any error for the bell has arrived
        xkb.GetState(xkb.UseCoreKbd, err => {
            X.removeListener('error', onError);
            should.not.exist(err);
            done();
        });
    });

    it('LatchLockState should lock a modifier, visible via GetState, then restore', function(t, done) {
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

    it('SelectEvents + eventOnly Bell should deliver an XkbBellNotify event', function(t, done) {
        xkb.SelectEvents(xkb.UseCoreKbd, xkb.EventType.BellNotify, 0,
            xkb.EventType.BellNotify, 0, 0);
        const onEvent = ev => {
            if (ev.name !== 'XkbBellNotify')
                return;
            X.removeListener('event', onEvent);
            // deselect again to not disturb later tests
            xkb.SelectEvents(xkb.UseCoreKbd, xkb.EventType.BellNotify,
                xkb.EventType.BellNotify, 0, 0, 0);
            ev.pitch.should.equal(440);
            ev.duration.should.equal(10);
            ev.eventOnly.should.equal(1);
            done();
        };
        X.on('event', onEvent);
        xkb.Bell(xkb.UseCoreKbd, xkb.DfltXIClass, xkb.DfltXIId, 50, 0, 1, 440, 10, 0, 0);
    });

    it('GetControls should return the default repeat timings', function(t, done) {
        xkb.GetControls(xkb.UseCoreKbd, (err, ctrls) => {
            should.not.exist(err);
            ctrls.numGroups.should.be.aboveOrEqual(1);
            ctrls.repeatDelay.should.be.above(0);
            ctrls.repeatInterval.should.be.above(0);
            ctrls.mouseKeysDfltBtn.should.be.above(0);
            ctrls.perKeyRepeat.length.should.equal(32);
            done();
        });
    });

    it('GetNames should return keycodes/symbols atoms and per-key names', function(t, done) {
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
            X.GetAtomName(names.keycodesName, (err, keycodesName) => {
                should.not.exist(err);
                keycodesName.length.should.be.above(0);
                done();
            });
        });
    });

    after(function(t, done) {
        // defensive: make sure no modifier lock leaks to other test files
        xkb.LatchLockState(xkb.UseCoreKbd, 0xff, 0, false, 0, 0xff, 0, false, 0);
        X.terminate();
        X.on('end', done);
    });
});
