const x11 = require('../lib');
const should = require('should');

describe('XInputExtension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.X.require('xinput', (err, ext) => {
                should.not.exist(err);
                self.xi = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('GetExtensionVersion should report the extension present', function(done) {
        this.xi.GetExtensionVersion((err, vers) => {
            should.not.exist(err);
            vers.present.should.equal(1);
            vers.serverMajor.should.be.aboveOrEqual(1);
            done();
        });
    });

    it('ListInputDevices should list the virtual core pointer and keyboard', function(done) {
        const xi = this.xi;
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
        should.exist(this.xi.xi2);
        this.xi.xi2.majorVersion.should.equal(2);
        this.xi.xi2.minorVersion.should.be.aboveOrEqual(0);
    });

    it('XIQueryDevice(AllDevices) should list master pointer/keyboard with classes', function(done) {
        const xi = this.xi;
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

    it('XIQueryDevice by id should return just that device', function(done) {
        const xi = this.xi;
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

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
