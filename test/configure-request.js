const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

describe('ConfigureRequest', () => {
    let X, root, wid;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            wid = X.AllocID();
            /* X acts like a WM */
            X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.SubstructureRedirect });
            X.CreateWindow(wid, root, 0, 0, 1, 1); // 1x1 pixel window
            X.QueryTree(root, (err, list) => {
                should.not.exist(err);
                list.children.indexOf(wid).should.not.equal(-1);
                done();
            });
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('should be emitted to the WM if a client configures its window', function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X.once('event', ev => {
                ev.name.should.equal('ConfigureRequest');
                ev.x.should.equal(0);
                ev.y.should.equal(20);
                ev.width.should.equal(200);
                ev.height.should.equal(300);
                ev.wid.should.equal(wid);
                done();
            });

            const other = dpy.client;
            other.MoveResizeWindow(wid, 0, 20, 200, 300);
        });

        client.on('error', done);
    });

    after(function(t, done) {
        X.DestroyWindow(wid);
        X.on('end', done);
        X.terminate();
    });
});
