const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');
const util = require('util');

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('RANDR extension', () => {
    let X, screen, root, randr, resources, output, crtc, onXError;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            screen = dpy.screen[0];
            root = screen.root;
            X.require('randr', (err, ext) => {
                assert.ifError(err);
                randr = ext;
                /* We HAVE to QueryVersion before using it. Otherwise it does not work as expected */
                randr.QueryVersion(1, 2, err => {
                    assert.ifError(err);
                    randr.GetScreenResources(root, (err, res) => {
                        assert.ifError(err);
                        resources = res;
                        output = res.outputs[0];
                        crtc = res.crtcs[0];
                        done();
                    });
                });
            });
        });

        client.on('error', err => {
            if (onXError) return onXError(err);
            done(err);
        });
    });

    // run callback-style steps one after another; the first error ends it
    const series = (steps, done) => {
        const next = err => {
            if (err || steps.length === 0)
                return done(err);
            steps.shift()(next);
        };
        next();
    };

    // issue a round-trip request and hand back any X error raised by
    // no-reply requests sent before it
    const syncError = (cb) => {
        let caught = null;
        onXError = err => { caught = err; };
        X.GetGeometry(root, () => {
            onXError = null;
            cb(caught);
        });
    };

    it('GetScreenInfo should get same px and mm width and height as in display.screen[0]', function(t, done) {
        randr.GetScreenInfo(root, (err, info) => {
            assert.ifError(err);
            const active_screen = info.screens[info.sizeID];
            assert.strictEqual(active_screen.px_width, screen.pixel_width);
            assert.strictEqual(active_screen.px_height, screen.pixel_height);
            assert.strictEqual(active_screen.mm_width, screen.mm_width);
            assert.strictEqual(active_screen.mm_height, screen.mm_height);
            done();
        });
    });

    it('GetScreenResources && GetOutputInfo', function(t, done) {
        randr.GetScreenResources(root, (err, resources) => {
            assert.ifError(err);
            assert.ok(resources != null);
            let pending = resources.outputs.length;
            if (pending === 0)
                return done();
            for (const output of resources.outputs) {
                randr.GetOutputInfo(output, 0, (err, info) => {
                    assert.ifError(err);
                    assert.ok(info != null);
                    assert.strictEqual(typeof info.name, 'string');
                    assert.ok(info.name.length > 0);
                    if (--pending === 0)
                        done();
                });
            }

        });
    });

    it('GetScreenSizeRange should contain the current screen size', function(t, done) {
        randr.GetScreenSizeRange(root, (err, range) => {
            assert.ifError(err);
            assert.ok(range.minWidth >= 1 && range.minWidth <= screen.pixel_width);
            assert.ok(range.minHeight >= 1 && range.minHeight <= screen.pixel_height);
            assert.ok(range.maxWidth >= screen.pixel_width);
            assert.ok(range.maxHeight >= screen.pixel_height);
            done();
        });
    });

    it('SetScreenSize to the current size should succeed and keep GetScreenInfo intact', function(t, done) {
        // only ever set the CURRENT size: other tests share this server
        randr.SetScreenSize(root, screen.pixel_width, screen.pixel_height,
            screen.mm_width, screen.mm_height);
        syncError(err => {
            assert.ifError(err);
            randr.GetScreenInfo(root, (err, info) => {
                assert.ifError(err);
                const active_screen = info.screens[info.sizeID];
                assert.strictEqual(active_screen.px_width, screen.pixel_width);
                assert.strictEqual(active_screen.px_height, screen.pixel_height);
                done();
            });
        });
    });

    it('GetScreenResourcesCurrent should match GetScreenResources', function(t, done) {
        randr.GetScreenResourcesCurrent(root, (err, current) => {
            assert.ifError(err);
            assert.deepStrictEqual(current.crtcs, resources.crtcs);
            assert.deepStrictEqual(current.outputs, resources.outputs);
            assert.strictEqual(current.modeinfos.length, resources.modeinfos.length);
            current.modeinfos.forEach((mode, i) => {
                assert.strictEqual(mode.name, resources.modeinfos[i].name);
                assert.strictEqual(mode.name.length, mode.name_len);
            });
            done();
        });
    });

    it('output property requests should round-trip create/query/get/delete', function(t, done) {
        let atom;
        series([
            cb => X.InternAtom(false, 'NODE_X11_RANDR_TEST_PROP', (err, a) => { atom = a; cb(err); }),
            cb => {
                randr.ChangeOutputProperty(output, atom, X.atoms.INTEGER, 32, 0, [42, 7]);
                syncError(cb);
            },
            cb => randr.GetOutputProperty(output, atom, 0, 0, 100, false, false, (err, prop) => {
                assert.ifError(err);
                assert.strictEqual(prop.format, 32);
                assert.strictEqual(prop.type, X.atoms.INTEGER);
                assert.strictEqual(prop.bytesAfter, 0);
                assert.strictEqual(prop.numItems, 2);
                assert.strictEqual(prop.data.readUInt32LE(0), 42);
                assert.strictEqual(prop.data.readUInt32LE(4), 7);
                cb();
            }),
            cb => randr.ListOutputProperties(output, (err, atoms) => {
                assert.ifError(err);
                assert.ok(atoms.includes(atom));
                cb();
            }),
            cb => {
                randr.ConfigureOutputProperty(output, atom, false, true, [0, 100]);
                syncError(cb);
            },
            cb => randr.QueryOutputProperty(output, atom, (err, info) => {
                assert.ifError(err);
                assert.strictEqual(info.pending, false);
                assert.strictEqual(info.range, true);
                assert.strictEqual(info.immutable, false);
                assert.deepStrictEqual(info.validValues, [0, 100]);
                cb();
            }),
            cb => {
                randr.DeleteOutputProperty(output, atom);
                syncError(cb);
            },
            cb => randr.ListOutputProperties(output, (err, atoms) => {
                assert.ifError(err);
                assert.ok(!atoms.includes(atom));
                cb();
            }),
            cb => randr.QueryOutputProperty(output, atom, err => {
                // property is gone: server must answer with BadName
                assert.ok(err != null);
                assert.strictEqual(err.error, 15);
                cb();
                return true; // error handled, don't emit on client
            })
        ], done);
    });

    it('CreateMode/AddOutputMode/DeleteOutputMode/DestroyMode lifecycle', function(t, done) {
        const modeInfo = {
            width: 320, height: 240, dot_clock: 5000000,
            h_sync_start: 328, h_sync_end: 360, h_total: 400, h_skew: 0,
            v_sync_start: 245, v_sync_end: 248, v_total: 260,
            modeflags: 0, name: 'nodex11_test_320x240'
        };
        randr.CreateMode(root, modeInfo, (err, mode) => {
            if (err) {
                // some servers refuse user modes; a controlled RANDR error
                // still proves the request was well-formed
                assert.strictEqual(err.minorOpcode, 16);
                assert.strictEqual(err.majorOpcode, randr.majorOpcode);
                done();
                return true;
            }
            assert.ok(mode > 0);
            series([
                cb => {
                    randr.AddOutputMode(output, mode);
                    syncError(cb);
                },
                cb => randr.GetOutputInfo(output, 0, (err, info) => {
                    assert.ifError(err);
                    assert.ok(info.modes.includes(mode));
                    cb();
                }),
                cb => {
                    randr.DeleteOutputMode(output, mode);
                    syncError(cb);
                },
                cb => {
                    randr.DestroyMode(mode);
                    syncError(cb);
                },
                cb => randr.GetOutputInfo(output, 0, (err, info) => {
                    assert.ifError(err);
                    assert.ok(!info.modes.includes(mode));
                    cb();
                })
            ], done);
        });
    });

    it('SetCrtcConfig re-applying the current config should return Success', function(t, done) {
        randr.GetCrtcInfo(crtc, resources.config_timestamp, (err, info) => {
            assert.ifError(err);
            assert.strictEqual(info.status, 0);
            // re-apply exactly what is already configured so nothing changes
            randr.SetCrtcConfig(crtc, info.timestamp, resources.config_timestamp,
                info.x, info.y, info.mode, info.rotation, info.output, (err, res) => {
                    assert.ifError(err);
                    assert.strictEqual(res.status, 0);
                    done();
                });
        });
    });

    it('GetCrtcGamma/SetCrtcGamma should round-trip and restore', function(t, done) {
        randr.GetCrtcGammaSize(crtc, (err, size) => {
            if (err) {
                // no gamma support on this crtc: a controlled RANDR error is
                // still proof the request reached the server
                assert.strictEqual(err.minorOpcode, 22);
                done();
                return true;
            }
            if (size === 0) return done(); // gamma not supported, nothing to set
            randr.GetCrtcGamma(crtc, (err, orig) => {
                assert.ifError(err);
                assert.strictEqual(orig.size, size);
                assert.strictEqual(orig.red.length, size);
                assert.strictEqual(orig.green.length, size);
                assert.strictEqual(orig.blue.length, size);
                const ramp = [];
                for (let i = 0; i < size; ++i)
                    ramp.push(Math.floor(i * 65535 / (size - 1)));
                randr.SetCrtcGamma(crtc, ramp, ramp, ramp);
                syncError(e => {
                    assert.ifError(e);
                    randr.GetCrtcGamma(crtc, (err, readBack) => {
                        assert.ifError(err);
                        assert.deepStrictEqual(readBack.red, ramp);
                        assert.deepStrictEqual(readBack.green, ramp);
                        assert.deepStrictEqual(readBack.blue, ramp);
                        // restore what was there before (shared server!)
                        randr.SetCrtcGamma(crtc, orig.red, orig.green, orig.blue);
                        syncError(e => {
                            assert.ifError(e);
                            randr.GetCrtcGamma(crtc, (err, restored) => {
                                assert.ifError(err);
                                assert.deepStrictEqual(restored.red, orig.red);
                                assert.deepStrictEqual(restored.green, orig.green);
                                assert.deepStrictEqual(restored.blue, orig.blue);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    it('GetCrtcTransform should report identity transforms by default', function(t, done) {
        randr.GetCrtcTransform(crtc, (err, info) => {
            assert.ifError(err);
            assert.deepStrictEqual(info.pendingTransform, IDENTITY);
            assert.deepStrictEqual(info.currentTransform, IDENTITY);
            assert.strictEqual(typeof info.hasTransforms, 'boolean');
            assert.strictEqual(typeof info.pendingFilter, 'string');
            assert.strictEqual(typeof info.currentFilter, 'string');
            assert.ok(Array.isArray(info.pendingParams));
            assert.ok(Array.isArray(info.currentParams));
            done();
        });
    });

    it('SetCrtcTransform succeeds or yields BadValue when transforms are unsupported', function(t, done) {
        randr.GetCrtcTransform(crtc, (err, info) => {
            assert.ifError(err);
            // identity transform: a no-op even where transforms are supported
            randr.SetCrtcTransform(crtc, IDENTITY, '', []);
            syncError(e => {
                if (info.hasTransforms) {
                    assert.ifError(e);
                } else {
                    // Xvfb: crtc has no transform support -> controlled BadValue
                    assert.ok(e != null);
                    assert.strictEqual(e.error, 2);
                    assert.strictEqual(e.minorOpcode, 26);
                    assert.strictEqual(e.majorOpcode, randr.majorOpcode);
                }
                done();
            });
        });
    });

    it('GetPanning should return the panning state', function(t, done) {
        randr.GetPanning(crtc, (err, panning) => {
            assert.ifError(err);
            assert.strictEqual(panning.status, 0);
            ['left', 'top', 'width', 'height',
                'trackLeft', 'trackTop', 'trackWidth', 'trackHeight',
                'borderLeft', 'borderTop', 'borderRight', 'borderBottom'].forEach(f => {
                assert.strictEqual(typeof panning[f], 'number');
            });
            done();
        });
    });

    it('SetPanning re-applying current state succeeds or yields a controlled RANDR error', function(t, done) {
        randr.GetPanning(crtc, (err, panning) => {
            assert.ifError(err);
            // re-apply the state just read so nothing actually changes
            randr.SetPanning(crtc, panning.timestamp, panning, (err, res) => {
                if (err) {
                    // Xvfb has no panning hook and answers with a RANDR error
                    assert.ok(err.error >= randr.firstError);
                    assert.strictEqual(err.minorOpcode, 29);
                    assert.strictEqual(err.majorOpcode, randr.majorOpcode);
                    done();
                    return true;
                }
                assert.strictEqual(res.status, 0);
                done();
            });
        });
    });

    it('SetOutputPrimary/GetOutputPrimary should round-trip and restore', function(t, done) {
        randr.GetOutputPrimary(root, (err, original) => {
            assert.ifError(err);
            randr.SetOutputPrimary(root, output);
            syncError(e => {
                assert.ifError(e);
                randr.GetOutputPrimary(root, (err, primary) => {
                    assert.ifError(err);
                    assert.strictEqual(primary, output);
                    // restore previous primary output (shared server!)
                    randr.SetOutputPrimary(root, original);
                    syncError(e => {
                        assert.ifError(e);
                        randr.GetOutputPrimary(root, (err, restored) => {
                            assert.ifError(err);
                            assert.strictEqual(restored, original);
                            done();
                        });
                    });
                });
            });
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
