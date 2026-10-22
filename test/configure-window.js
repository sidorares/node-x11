const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');
const util = require('util');

describe('ConfigureWindow', () => {
    let X, wid, wid_helper;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            wid = X.AllocID();
            wid_helper = X.AllocID();
            X.CreateWindow(wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            X.CreateWindow(wid_helper, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            X.QueryTree(dpy.screen[0].root, (err, list) => {
                assert.ifError(err);
                assert.notStrictEqual(list.children.indexOf(wid), -1);
                assert.notStrictEqual(list.children.indexOf(wid_helper), -1);
                X.ChangeWindowAttributes(wid, { eventMask: x11.eventMask.StructureNotify });
                done();
            });
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('should ResizeWindow correctly to 200x300 pixels', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.type, 22); /* ConfigureNotify */
            assert.strictEqual(ev.height, 300);
            assert.strictEqual(ev.width, 200);
            done();
        });
        X.ResizeWindow(wid, 200, 300);
    });

    it('should MoveWindow correctly to x: 100, y: 150 pixels', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.type, 22); /* ConfigureNotify */
            assert.strictEqual(ev.x, 100);
            assert.strictEqual(ev.y, 150);
            done();
        });
        X.MoveWindow(wid, 100, 150);
    });

    it('should MoveResizeWindow correctly to x: 200, y: 250 and 500x100 pixels', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.type, 22); /* ConfigureNotify */
            assert.strictEqual(ev.x, 200);
            assert.strictEqual(ev.y, 250);
            assert.strictEqual(ev.height, 100);
            assert.strictEqual(ev.width, 500);
            done();
        });
        X.MoveResizeWindow(wid, 200, 250, 500, 100);
    });

    it('should RaiseWindow correctly', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.type, 22); /* ConfigureNotify */
            assert.strictEqual(ev.aboveSibling, wid_helper);
            done();
        });
        X.RaiseWindow(wid);
    });

    it('should LowerWindow correctly', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.type, 22); /* ConfigureNotify */
            assert.strictEqual(ev.aboveSibling, 0); /* 0 -> no window below this */
            done();
        });
        X.LowerWindow(wid);
    });

    it('should ignore invalid mask values', function(t, done) {
        X.once('event', ev => {
            assert.strictEqual(ev.x, 0);
            done();
        });

        X.ConfigureWindow(wid, { foo : 3, x : 0 }, err => {
            console.log(err);
        });
    });

    after(function(t, done) {
        X.removeAllListeners('event');
        X.DestroyWindow(wid);
        X.DestroyWindow(wid_helper);
        X.on('end', done);
        X.terminate();
    });
});
