const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('CreateGC', () => {
    let X, root, white, black, wid, client, gc;

    before(function(t, done) {
        client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            white = dpy.screen[0].white_pixel;
            black = dpy.screen[0].black_pixel;
            wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 1, 1); // 1x1 pixel window
            X.MapWindow(wid);
            X.QueryTree(root, (err, list) => {
                assert.ifError(err);
                assert.notStrictEqual(list.children.indexOf(wid), -1);
                done();
            });
        });
    });

    it('should create a Graphic Context correctly', function() {
        client.on('error', err => {
            assert.ifError(err);
        });

        gc = X.AllocID();
        X.CreateGC(gc,
                        wid,
                        {
                            foreground: black,
                            background: white,
                            lineStyle : 0
                        }
        );
        
        X.ChangeGC(gc,
                   {
                       foreground: 0xffff00,
                       background: 0x0000ff,
                       lineStyle : 2
                   }
        );
    });

    after(function(t, done) {
        X.DestroyWindow(wid);
        X.on('end', done);
        X.terminate();
    });
});
