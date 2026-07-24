const x11 = require('../lib');
const should = require('should');

describe('MIT-SCREEN-SAVER extension', () => {
    let display;
    let X;
    let saver;
    let root;

    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            X.require('screen-saver', (err, ext) => {
                should.not.exist(err);
                saver = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after(done => {
        // safety: never leave the shared server suspended or with saver attributes set
        saver.Suspend(false);
        saver.UnsetAttributes(root);
        X.GetInputFocus(() => {
            X.terminate();
            X.on('end', done);
        });
    });

    it('QueryVersion (auto) should report version 1.x', () => {
        saver.major.should.equal(1);
        saver.minor.should.be.aboveOrEqual(1);
    });

    it('QueryInfo should return saver info for the root window', done => {
        saver.QueryInfo(root, (err, info) => {
            should.not.exist(err);
            info.state.should.be.within(0, 3);
            info.idle.should.be.a.Number();
            info.until.should.be.a.Number();
            info.kind.should.be.within(0, 2);
            done();
        });
    });

    it('SetAttributes then UnsetAttributes should be accepted', done => {
        // class/depth/visual 0 = CopyFromParent
        saver.SetAttributes(root, 0, 0, 100, 100, 0, 0, 0, 0,
            { backgroundPixel: display.screen[0].black_pixel });
        saver.UnsetAttributes(root);
        // sync: any error in the two requests above would arrive before this reply
        saver.QueryInfo(root, (err, info) => {
            should.not.exist(err);
            should.exist(info);
            done();
        });
    });

    it('Suspend on/off should be accepted and leave the saver queryable', done => {
        saver.Suspend(true);
        saver.QueryInfo(root, (err, info) => {
            // always release the suspension, even if the assertion below throws
            saver.Suspend(false);
            should.not.exist(err);
            should.exist(info);
            saver.QueryInfo(root, (err2, info2) => {
                should.not.exist(err2);
                info2.state.should.be.within(0, 3);
                done();
            });
        });
    });
});
