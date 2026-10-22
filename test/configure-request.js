const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('ConfigureRequest', () => {
    let X, root, wid;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            wid = X.AllocID();
            /* X acts like a WM */
            X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.SubstructureRedirect });
            X.CreateWindow(wid, root, 0, 0, 1, 1); // 1x1 pixel window
            X.QueryTree(root, (err, list) => {
                assert.ifError(err);
                assert.notStrictEqual(list.children.indexOf(wid), -1);
                done();
            });
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('should be emitted to the WM if a client configures its window', function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X.once('event', ev => {
                assert.strictEqual(ev.name, 'ConfigureRequest');
                assert.strictEqual(ev.x, 0);
                assert.strictEqual(ev.y, 20);
                assert.strictEqual(ev.width, 200);
                assert.strictEqual(ev.height, 300);
                assert.strictEqual(ev.wid, wid);
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
