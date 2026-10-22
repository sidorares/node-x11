const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('XKEYBOARD extension', () => {
    let X, xkb;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            X.require('xkb', (err, ext) => {
                assert.ifError(err);
                xkb = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('UseExtension should report a supported 1.x server version', function() {
        assert.strictEqual(xkb.supported, 1);
        assert.strictEqual(xkb.serverMajor, 1);
        assert.ok(xkb.serverMinor >= 0);
    });

    it('GetState should return group and modifier state of the core keyboard', function(t, done) {
        xkb.GetState(xkb.UseCoreKbd, (err, state) => {
            assert.ifError(err);
            assert.ok(state.deviceID > 0);
            assert.ok(state.group >= 0 && state.group <= 3);
            assert.ok(state.lockedGroup >= 0 && state.lockedGroup <= 3);
            assert.ok(state.mods >= 0 && state.mods <= 255);
            assert.ok(state.baseMods >= 0 && state.baseMods <= 255);
            assert.ok(state.latchedMods >= 0 && state.latchedMods <= 255);
            assert.ok(state.lockedMods >= 0 && state.lockedMods <= 255);
            assert.strictEqual(typeof state.ptrBtnState, 'number');
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
            assert.ifError(err);
            done();
        });
    });

    it('LatchLockState should lock a modifier, visible via GetState, then restore', function(t, done) {
        const lockMask = xkb.ModMask.Lock; // caps lock
        xkb.LatchLockState(xkb.UseCoreKbd, lockMask, lockMask, false, 0, 0, 0, false, 0);
        xkb.GetState(xkb.UseCoreKbd, (err, state) => {
            assert.ifError(err);
            assert.strictEqual(state.lockedMods & lockMask, lockMask);
            // restore: other tests share the server's keyboard state
            xkb.LatchLockState(xkb.UseCoreKbd, lockMask, 0, false, 0, 0, 0, false, 0);
            xkb.GetState(xkb.UseCoreKbd, (err, state) => {
                assert.ifError(err);
                assert.strictEqual(state.lockedMods & lockMask, 0);
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
            assert.strictEqual(ev.pitch, 440);
            assert.strictEqual(ev.duration, 10);
            assert.strictEqual(ev.eventOnly, 1);
            done();
        };
        X.on('event', onEvent);
        xkb.Bell(xkb.UseCoreKbd, xkb.DfltXIClass, xkb.DfltXIId, 50, 0, 1, 440, 10, 0, 0);
    });

    it('GetControls should return the default repeat timings', function(t, done) {
        xkb.GetControls(xkb.UseCoreKbd, (err, ctrls) => {
            assert.ifError(err);
            assert.ok(ctrls.numGroups >= 1);
            assert.ok(ctrls.repeatDelay > 0);
            assert.ok(ctrls.repeatInterval > 0);
            assert.ok(ctrls.mouseKeysDfltBtn > 0);
            assert.strictEqual(ctrls.perKeyRepeat.length, 32);
            done();
        });
    });

    it('GetNames should return keycodes/symbols atoms and per-key names', function(t, done) {
        const which = xkb.NameDetail.Keycodes | xkb.NameDetail.Symbols |
            xkb.NameDetail.KeyNames | xkb.NameDetail.GroupNames |
            xkb.NameDetail.VirtualModNames | xkb.NameDetail.IndicatorNames;
        xkb.GetNames(xkb.UseCoreKbd, which, (err, names) => {
            assert.ifError(err);
            assert.strictEqual(names.which, which);
            assert.ok(names.minKeyCode > 0);
            assert.ok(names.maxKeyCode > names.minKeyCode);
            assert.strictEqual(names.keyNames.length, names.nKeys);
            assert.ok(names.keyNames.includes('AE01'));
            assert.ok(names.virtualModNames.length > 0);
            assert.ok(names.keycodesName > 0);
            assert.ok(names.symbolsName > 0);
            X.GetAtomName(names.keycodesName, (err, keycodesName) => {
                assert.ifError(err);
                assert.ok(keycodesName.length > 0);
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
