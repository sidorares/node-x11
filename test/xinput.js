const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

describe('XInputExtension', () => {
    let X, xi, xtest, wid;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            X.require('xinput', (err, ext) => {
                should.not.exist(err);
                xi = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('GetExtensionVersion should report the extension present', function(t, done) {
        xi.GetExtensionVersion((err, vers) => {
            should.not.exist(err);
            vers.present.should.equal(1);
            vers.serverMajor.should.be.aboveOrEqual(1);
            done();
        });
    });

    it('ListInputDevices should list the virtual core pointer and keyboard', function(t, done) {
        xi.ListInputDevices((err, devices) => {
            should.not.exist(err);
            devices.length.should.be.aboveOrEqual(2);

            const pointer = devices.find(dev => dev.use === xi.DeviceUse.IsXPointer);
            const keyboard = devices.find(dev => dev.use === xi.DeviceUse.IsXKeyboard);
            should.exist(pointer);
            should.exist(keyboard);
            pointer.name.should.equal('Virtual core pointer');
            keyboard.name.should.equal('Virtual core keyboard');

            const buttonClass = pointer.classes.find(cls => cls.classId === xi.InputClass.Button);
            should.exist(buttonClass);
            buttonClass.numButtons.should.be.above(0);
            const valuatorClass = pointer.classes.find(cls => cls.classId === xi.InputClass.Valuator);
            should.exist(valuatorClass);
            valuatorClass.axes.length.should.be.aboveOrEqual(2);

            const keyClass = keyboard.classes.find(cls => cls.classId === xi.InputClass.Key);
            should.exist(keyClass);
            keyClass.minKeycode.should.be.above(0);
            keyClass.maxKeycode.should.be.above(keyClass.minKeycode);
            keyClass.numKeys.should.equal(keyClass.maxKeycode - keyClass.minKeycode + 1);
            done();
        });
    });

    it('XIQueryVersion should have negotiated XI 2.x', function() {
        should.exist(xi.xi2);
        xi.xi2.majorVersion.should.equal(2);
        xi.xi2.minorVersion.should.be.aboveOrEqual(0);
    });

    it('XIQueryDevice(AllDevices) should list master pointer/keyboard with classes', function(t, done) {
        xi.XIQueryDevice(xi.AllDevices, (err, devices) => {
            should.not.exist(err);
            devices.length.should.be.aboveOrEqual(2);

            const master = devices.find(dev => dev.use === xi.DeviceType.MasterPointer);
            const masterKbd = devices.find(dev => dev.use === xi.DeviceType.MasterKeyboard);
            should.exist(master);
            should.exist(masterKbd);
            master.name.should.equal('Virtual core pointer');
            masterKbd.name.should.equal('Virtual core keyboard');
            // master devices are paired with each other
            master.attachment.should.equal(masterKbd.deviceId);
            masterKbd.attachment.should.equal(master.deviceId);
            master.enabled.should.equal(1);

            const buttonClass = master.classes.find(cls => cls.type === xi.ClassType.Button);
            should.exist(buttonClass);
            buttonClass.numButtons.should.be.above(0);
            buttonClass.labels.length.should.equal(buttonClass.numButtons);

            const valuators = master.classes.filter(cls => cls.type === xi.ClassType.Valuator);
            valuators.length.should.be.aboveOrEqual(2);
            valuators[0].number.should.equal(0);
            valuators[0].mode.should.be.within(0, 1);

            const keyClass = masterKbd.classes.find(cls => cls.type === xi.ClassType.Key);
            should.exist(keyClass);
            keyClass.keycodes.length.should.be.above(0);
            done();
        });
    });

    it('XIQueryDevice by id should return just that device', function(t, done) {
        xi.XIQueryDevice(xi.AllMasterDevices, (err, masters) => {
            should.not.exist(err);
            const pointerId = masters.find(dev => dev.use === xi.DeviceType.MasterPointer).deviceId;
            xi.XIQueryDevice(pointerId, (err, devices) => {
                should.not.exist(err);
                devices.length.should.equal(1);
                devices[0].deviceId.should.equal(pointerId);
                devices[0].name.should.equal('Virtual core pointer');
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
                should.not.exist(err);
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

            ev.name.should.equal('XIRawMotion');
            ev.deviceId.should.be.above(0);
            ev.sourceId.should.be.above(0);
            ev.time.should.be.above(0);
            // a pointer motion moves x and y, valuators 0 and 1
            Object.keys(ev.valuators).length.should.be.aboveOrEqual(1);
            Object.keys(ev.rawValuators).length.should.equal(Object.keys(ev.valuators).length);
            for (const axis of Object.keys(ev.valuators))
                ev.valuators[axis].should.be.a.Number();
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

            ev.name.should.equal('XIMotion');
            ev.root.should.equal(root);
            ev.wid.should.equal(wid, 'the window the selection was made on');
            // FP1616 decoded back to the coordinates XTEST asked for
            Math.round(ev.rootx).should.equal(61);
            Math.round(ev.rooty).should.equal(71);
            Math.round(ev.x).should.equal(61);
            Math.round(ev.y).should.equal(71);
            ev.mods.should.have.properties(['base', 'latched', 'locked', 'effective']);
            ev.group.should.have.properties(['base', 'latched', 'locked', 'effective']);
            ev.buttons.should.be.an.Array();
            ev.valuators.should.be.an.Object();
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
            press.name.should.equal('XIButtonPress');
            press.detail.should.equal(1, 'button 1');

            // the mask is what makes the parse worth doing: a motion while
            // the button is held has to report it down. It sits behind a
            // variable-length mask that the valuator offsets depend on, so
            // getting its length wrong silently misplaces the axis values too
            const drag = await nextXIEvent(X, xi.EventType.Motion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 150, 120);
            });
            drag.buttons.should.containEql(1, 'button 1 held during the motion');
            Math.round(drag.valuators[0]).should.equal(150, 'and the axes are still where expected');
            Math.round(drag.valuators[1]).should.equal(120);

            const release = await nextXIEvent(X, xi.EventType.ButtonRelease, () => {
                xtest.FakeInput(xtest.ButtonRelease, 1, 0, root, 0, 0);
            });
            release.detail.should.equal(1);
            // the mask is the state *before* the event, the same convention
            // core X uses for its `state` field: the press does not yet see
            // its own button, the release still does
            press.buttons.should.not.containEql(1);
            release.buttons.should.containEql(1);
        });

        it('should accept event type names as well as a bitmask', async function() {
            const root = X.display.screen[0].root;
            xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: ['RawMotion'] });

            const ev = await nextXIEvent(X, xi.EventType.RawMotion, () => {
                xtest.FakeInput(xtest.MotionNotify, 0, 0, root, 12, 24);
            });
            ev.name.should.equal('XIRawMotion');
        });

        it('should reject an unknown event type name', function() {
            const root = X.display.screen[0].root;
            (() => xi.XISelectEvents(root, { deviceId: xi.AllMasterDevices, mask: ['Nonsense'] }))
                .should.throw(/unknown event type Nonsense/);
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
            heard.should.equal(false);
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
            ev.deviceId.should.equal(pointer.deviceId, 'named the device we asked about');

            // and the keyboard selection in the same request took effect too
            const key = await nextXIEvent(X, xi.EventType.RawKeyPress, () => {
                xtest.FakeInput(xtest.KeyPress, 38, 0, root, 0, 0);
                xtest.FakeInput(xtest.KeyRelease, 38, 0, root, 0, 0);
            });
            key.name.should.equal('XIRawKeyPress');
            key.detail.should.equal(38, 'the keycode');
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
