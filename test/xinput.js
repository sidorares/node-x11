const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('XInputExtension', () => {
    let X, xi, xtest, wid;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            X.require('xinput', (err, ext) => {
                assert.ifError(err);
                xi = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('GetExtensionVersion should report the extension present', function(t, done) {
        xi.GetExtensionVersion((err, vers) => {
            assert.ifError(err);
            assert.strictEqual(vers.present, 1);
            assert.ok(vers.serverMajor >= 1);
            done();
        });
    });

    it('ListInputDevices should list the virtual core pointer and keyboard', function(t, done) {
        xi.ListInputDevices((err, devices) => {
            assert.ifError(err);
            assert.ok(devices.length >= 2);

            const pointer = devices.find(dev => dev.use === xi.DeviceUse.IsXPointer);
            const keyboard = devices.find(dev => dev.use === xi.DeviceUse.IsXKeyboard);
            assert.ok(pointer != null);
            assert.ok(keyboard != null);
            assert.strictEqual(pointer.name, 'Virtual core pointer');
            assert.strictEqual(keyboard.name, 'Virtual core keyboard');

            const buttonClass = pointer.classes.find(cls => cls.classId === xi.InputClass.Button);
            assert.ok(buttonClass != null);
            assert.ok(buttonClass.numButtons > 0);
            const valuatorClass = pointer.classes.find(cls => cls.classId === xi.InputClass.Valuator);
            assert.ok(valuatorClass != null);
            assert.ok(valuatorClass.axes.length >= 2);

            const keyClass = keyboard.classes.find(cls => cls.classId === xi.InputClass.Key);
            assert.ok(keyClass != null);
            assert.ok(keyClass.minKeycode > 0);
            assert.ok(keyClass.maxKeycode > keyClass.minKeycode);
            assert.strictEqual(keyClass.numKeys, keyClass.maxKeycode - keyClass.minKeycode + 1);
            done();
        });
    });

    it('XIQueryVersion should have negotiated XI 2.x', function() {
        assert.ok(xi.xi2 != null);
        assert.strictEqual(xi.xi2.majorVersion, 2);
        assert.ok(xi.xi2.minorVersion >= 0);
    });

    it('XIQueryDevice(AllDevices) should list master pointer/keyboard with classes', function(t, done) {
        xi.XIQueryDevice(xi.AllDevices, (err, devices) => {
            assert.ifError(err);
            assert.ok(devices.length >= 2);

            const master = devices.find(dev => dev.use === xi.DeviceType.MasterPointer);
            const masterKbd = devices.find(dev => dev.use === xi.DeviceType.MasterKeyboard);
            assert.ok(master != null);
            assert.ok(masterKbd != null);
            assert.strictEqual(master.name, 'Virtual core pointer');
            assert.strictEqual(masterKbd.name, 'Virtual core keyboard');
            // master devices are paired with each other
            assert.strictEqual(master.attachment, masterKbd.deviceId);
            assert.strictEqual(masterKbd.attachment, master.deviceId);
            assert.strictEqual(master.enabled, 1);

            const buttonClass = master.classes.find(cls => cls.type === xi.ClassType.Button);
            assert.ok(buttonClass != null);
            assert.ok(buttonClass.numButtons > 0);
            assert.strictEqual(buttonClass.labels.length, buttonClass.numButtons);

            const valuators = master.classes.filter(cls => cls.type === xi.ClassType.Valuator);
            assert.ok(valuators.length >= 2);
            assert.strictEqual(valuators[0].number, 0);
            assert.ok(valuators[0].mode >= 0 && valuators[0].mode <= 1);

            const keyClass = masterKbd.classes.find(cls => cls.type === xi.ClassType.Key);
            assert.ok(keyClass != null);
            assert.ok(keyClass.keycodes.length > 0);
            done();
        });
    });

    it('XIQueryDevice by id should return just that device', function(t, done) {
        xi.XIQueryDevice(xi.AllMasterDevices, (err, masters) => {
            assert.ifError(err);
            const pointerId = masters.find(dev => dev.use === xi.DeviceType.MasterPointer).deviceId;
            xi.XIQueryDevice(pointerId, (err, devices) => {
                assert.ifError(err);
                assert.strictEqual(devices.length, 1);
                assert.strictEqual(devices[0].deviceId, pointerId);
                assert.strictEqual(devices[0].name, 'Virtual core pointer');
                done();
            });
        });
    });

    // XI2 event delivery. XTEST drives the real pointer, so these check the
    // wire layouts against what the server actually sends rather than against
    // a hand-built buffer.
    describe('XISelectEvents', () => {
        before(function(t, done) {
            X.require('xtest', (err, ext) => {
                assert.ifError(err);
                xtest = ext;
                // Xvfb outlives the test run and remembers which buttons are
                // down, so a run that failed mid-drag leaves button 1 pressed
                // and the next run's FakeInput press is a no-op the server
                // never reports. Start from a known state.
                const root = X.display.screen[0].root;
                for (let button = 1; button <= 3; ++button)
                    xtest.FakeInput(xtest.ButtonRelease, button, 0, root, 0, 0);
                // Non-raw device events go to the window under the pointer and
                // propagate up, so where the pointer happens to be decides who
                // hears them. Earlier suites move it around, so own a window
                // and put the pointer in it rather than selecting on the root
                // and hoping. Raw events ignore all of this - they only ever
                // go to a root selection - which is why they kept arriving
                // while these did not.
                wid = X.AllocID();
                X.CreateWindow(wid, root, 0, 0, 200, 200, 0, 0, 0, 0,
                    { overrideRedirect: true });
                X.MapWindow(wid);
                X.GetInputFocus(() => done());
            });
        });

        /** Wait for the first XI2 event matching `evtype`, or time out. */
        const nextXIEvent = (X, evtype, act, timeout = 2000) =>
            new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    X.removeListener('event', onEvent);
                    reject(new Error(`no XI2 event ${evtype} within ${timeout}ms`));
                }, timeout);
                function onEvent(ev) {
                    if (ev.type !== 35 || ev.evtype !== evtype) return;
                    clearTimeout(timer);
                    X.removeListener('event', onEvent);
                    resolve(ev);
                }
                X.on('event', onEvent);
                act();
            });

        it('should deliver XIRawMotion with the device axis values', async function() {
            const root = X.display.screen[0].root;
            xi.XISelectEvents(root, {
                deviceId: xi.AllMasterDevices,
                mask: xi.EventMask.RawMotion
            });

            const ev = await nextXIEvent(X, xi.EventType.RawMotion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 37, 53);
            });

            assert.strictEqual(ev.name, 'XIRawMotion');
            assert.ok(ev.deviceId > 0);
            assert.ok(ev.sourceId > 0);
            assert.ok(ev.time > 0);
            // a pointer motion moves x and y, valuators 0 and 1
            assert.ok(Object.keys(ev.valuators).length >= 1);
            assert.strictEqual(Object.keys(ev.rawValuators).length, Object.keys(ev.valuators).length);
            for (const axis of Object.keys(ev.valuators))
                assert.strictEqual(typeof ev.valuators[axis], 'number');
        });

        it('should deliver XIMotion with window coordinates and modifier state', async function() {
            const root = X.display.screen[0].root;
            xi.XISelectEvents(wid, {
                deviceId: xi.AllMasterDevices,
                mask: xi.EventMask.Motion
            });

            const ev = await nextXIEvent(X, xi.EventType.Motion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 61, 71);
            });

            assert.strictEqual(ev.name, 'XIMotion');
            assert.strictEqual(ev.root, root);
            assert.strictEqual(ev.wid, wid, 'the window the selection was made on');
            // FP1616 decoded back to the coordinates XTEST asked for
            assert.strictEqual(Math.round(ev.rootx), 61);
            assert.strictEqual(Math.round(ev.rooty), 71);
            assert.strictEqual(Math.round(ev.x), 61);
            assert.strictEqual(Math.round(ev.y), 71);
            for (const field of ['base', 'latched', 'locked', 'effective']) {
                assert.ok(field in ev.mods, `mods.${field}`);
                assert.ok(field in ev.group, `group.${field}`);
            }
            assert.ok(Array.isArray(ev.buttons));
            assert.ok(ev.valuators !== null && typeof ev.valuators === 'object');
        });

        it('should report the button in detail and in the button mask', async function() {
            const root = X.display.screen[0].root;
            xi.XISelectEvents(wid, {
                deviceId: xi.AllMasterDevices,
                mask: xi.EventMask.ButtonPress | xi.EventMask.ButtonRelease | xi.EventMask.Motion
            });
            // inside the window, so the press has somewhere to be delivered
            xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 100, 100);

            const press = await nextXIEvent(X, xi.EventType.ButtonPress, () => {
                xtest.FakeInput(xtest.ButtonPress, 1, 0, root, 0, 0);
            });
            assert.strictEqual(press.name, 'XIButtonPress');
            assert.strictEqual(press.detail, 1, 'button 1');

            // the mask is what makes the parse worth doing: a motion while
            // the button is held has to report it down. It sits behind a
            // variable-length mask that the valuator offsets depend on, so
            // getting its length wrong silently misplaces the axis values too
            const drag = await nextXIEvent(X, xi.EventType.Motion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 150, 120);
            });
            assert.ok(drag.buttons.includes(1), 'button 1 held during the motion');
            assert.strictEqual(Math.round(drag.valuators[0]), 150, 'and the axes are still where expected');
            assert.strictEqual(Math.round(drag.valuators[1]), 120);

            const release = await nextXIEvent(X, xi.EventType.ButtonRelease, () => {
                xtest.FakeInput(xtest.ButtonRelease, 1, 0, root, 0, 0);
            });
            assert.strictEqual(release.detail, 1);
            // the mask is the state *before* the event, the same convention
            // core X uses for its `state` field: the press does not yet see
            // its own button, the release still does
            assert.ok(!press.buttons.includes(1));
            assert.ok(release.buttons.includes(1));
        });

        it('should accept event type names as well as a bitmask', async function() {
            const root = X.display.screen[0].root;
            xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: ['RawMotion'] });

            const ev = await nextXIEvent(X, xi.EventType.RawMotion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 12, 24);
            });
            assert.strictEqual(ev.name, 'XIRawMotion');
        });

        it('should reject an unknown event type name', function() {
            const root = X.display.screen[0].root;
            assert.throws(() => xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: ['Nonsense'] }), /unknown event type Nonsense/);
        });

        it('an empty mask deselects', async function() {
            const root = X.display.screen[0].root;
            xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: xi.EventMask.RawMotion });
            // prove the selection is live before turning it off, so a broken
            // deselect cannot pass by the events never having arrived
            await nextXIEvent(X, xi.EventType.RawMotion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 5, 5);
            });

            xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: 0 });
            await new Promise((resolve, reject) =>
                X.GetInputFocus(err => (err ? reject(err) : resolve())));

            let heard = false;
            const onEvent = ev => {
                if (ev.type === 35 && ev.evtype === xi.EventType.RawMotion) heard = true;
            };
            X.on('event', onEvent);
            xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 99, 99);
            await new Promise((resolve, reject) =>
                X.GetInputFocus(err => (err ? reject(err) : resolve())));
            X.removeListener('event', onEvent);
            assert.strictEqual(heard, false);
        });

        it('should select for several devices in one request', async function() {
            const root = X.display.screen[0].root;
            const masters = await new Promise((resolve, reject) =>
                xi.XIQueryDevice(xi.AllMasterDevices, (err, devices) =>
                    err ? reject(err) : resolve(devices)));
            const pointer = masters.find(d => d.use === xi.DeviceType.MasterPointer);
            const keyboard = masters.find(d => d.use === xi.DeviceType.MasterKeyboard);

            xi.XISelectEvents(root, [
                { deviceId: pointer.deviceId, mask: xi.EventMask.RawMotion },
                { deviceId: keyboard.deviceId, mask: xi.EventMask.RawKeyPress }
            ]);

            const ev = await nextXIEvent(X, xi.EventType.RawMotion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 43, 21);
            });
            assert.strictEqual(ev.deviceId, pointer.deviceId, 'named the device we asked about');

            // and the keyboard selection in the same request took effect too
            const key = await nextXIEvent(X, xi.EventType.RawKeyPress, () => {
                xtest.FakeInput(xtest.KeyPress, 38, 0, root, 0, 0);
                xtest.FakeInput(xtest.KeyRelease, 38, 0, root, 0, 0);
            });
            assert.strictEqual(key.name, 'XIRawKeyPress');
            assert.strictEqual(key.detail, 38, 'the keycode');
        });

        after(function(t, done) {
            const root = X.display.screen[0].root;
            // leave no button held: the server is shared and outlives us
            for (let button = 1; button <= 3; ++button)
                xtest.FakeInput(xtest.ButtonRelease, button, 0, root, 0, 0);
            xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: 0 });
            if (wid)
                X.DestroyWindow(wid);
            X.GetInputFocus(() => done());
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
