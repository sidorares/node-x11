const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const async = require('async');
const should = require('should');
const assert = require('assert');
const util = require('util');

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('RANDR extension', () => {
    let X, screen, root, randr, resources, output, crtc, onXError;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            screen = dpy.screen[0];
            root = screen.root;
            X.require('randr', (err, ext) => {
                should.not.exist(err);
                randr = ext;
                /* We HAVE to QueryVersion before using it. Otherwise it does not work as expected */
                randr.QueryVersion(1, 2, err => {
                    should.not.exist(err);
                    randr.GetScreenResources(root, (err, res) => {
                        should.not.exist(err);
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
            should.not.exist(err);
            const active_screen = info.screens[info.sizeID];
            active_screen.px_width.should.equal(screen.pixel_width);
            active_screen.px_height.should.equal(screen.pixel_height);
            active_screen.mm_width.should.equal(screen.mm_width);
            active_screen.mm_height.should.equal(screen.mm_height);
            done();
        });
    });

    it('GetScreenResources && GetOutputInfo', function(t, done) {
        randr.GetScreenResources(root, (err, resources) => {
            should.not.exist(err);
            should.exist(resources);
            async.each(
                resources.outputs,
                (output, cb) => {
                    randr.GetOutputInfo(output, 0, (err, info) => {
                        should.not.exist(err);
                        should.exist(info);
                        info.name.should.be.a.String();
                        info.name.length.should.be.above(0);
                        cb();
                    });
                },
                done
            );

        });
    });

    it('GetScreenSizeRange should contain the current screen size', function(t, done) {
        randr.GetScreenSizeRange(root, (err, range) => {
            should.not.exist(err);
            range.minWidth.should.be.within(1, screen.pixel_width);
            range.minHeight.should.be.within(1, screen.pixel_height);
            range.maxWidth.should.not.be.below(screen.pixel_width);
            range.maxHeight.should.not.be.below(screen.pixel_height);
            done();
        });
    });

    it('SetScreenSize to the current size should succeed and keep GetScreenInfo intact', function(t, done) {
        // only ever set the CURRENT size: other tests share this server
        randr.SetScreenSize(root, screen.pixel_width, screen.pixel_height,
            screen.mm_width, screen.mm_height);
        syncError(err => {
            should.not.exist(err);
            randr.GetScreenInfo(root, (err, info) => {
                should.not.exist(err);
                const active_screen = info.screens[info.sizeID];
                active_screen.px_width.should.equal(screen.pixel_width);
                active_screen.px_height.should.equal(screen.pixel_height);
                done();
            });
        });
    });

    it('GetScreenResourcesCurrent should match GetScreenResources', function(t, done) {
        randr.GetScreenResourcesCurrent(root, (err, current) => {
            should.not.exist(err);
            current.crtcs.should.eql(resources.crtcs);
            current.outputs.should.eql(resources.outputs);
            current.modeinfos.length.should.equal(resources.modeinfos.length);
            current.modeinfos.forEach((mode, i) => {
                mode.name.should.equal(resources.modeinfos[i].name);
                mode.name.length.should.equal(mode.name_len);
            });
            done();
        });
    });

    it('output property requests should round-trip create/query/get/delete', function(t, done) {
        let atom;
        async.series([
            cb => X.InternAtom(false, 'NODE_X11_RANDR_TEST_PROP', (err, a) => { atom = a; cb(err); }),
            cb => {
                randr.ChangeOutputProperty(output, atom, X.atoms.INTEGER, 32, 0, [42, 7]);
                syncError(cb);
            },
            cb => randr.GetOutputProperty(output, atom, 0, 0, 100, false, false, (err, prop) => {
                should.not.exist(err);
                prop.format.should.equal(32);
                prop.type.should.equal(X.atoms.INTEGER);
                prop.bytesAfter.should.equal(0);
                prop.numItems.should.equal(2);
                prop.data.readUInt32LE(0).should.equal(42);
                prop.data.readUInt32LE(4).should.equal(7);
                cb();
            }),
            cb => randr.ListOutputProperties(output, (err, atoms) => {
                should.not.exist(err);
                atoms.should.containEql(atom);
                cb();
            }),
            cb => {
                randr.ConfigureOutputProperty(output, atom, false, true, [0, 100]);
                syncError(cb);
            },
            cb => randr.QueryOutputProperty(output, atom, (err, info) => {
                should.not.exist(err);
                info.pending.should.equal(false);
                info.range.should.equal(true);
                info.immutable.should.equal(false);
                info.validValues.should.eql([0, 100]);
                cb();
            }),
            cb => {
                randr.DeleteOutputProperty(output, atom);
                syncError(cb);
            },
            cb => randr.ListOutputProperties(output, (err, atoms) => {
                should.not.exist(err);
                atoms.should.not.containEql(atom);
                cb();
            }),
            cb => randr.QueryOutputProperty(output, atom, err => {
                // property is gone: server must answer with BadName
                should.exist(err);
                err.error.should.equal(15);
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
                err.minorOpcode.should.equal(16);
                err.majorOpcode.should.equal(randr.majorOpcode);
                done();
                return true;
            }
            mode.should.be.above(0);
            async.series([
                cb => {
                    randr.AddOutputMode(output, mode);
                    syncError(cb);
                },
                cb => randr.GetOutputInfo(output, 0, (err, info) => {
                    should.not.exist(err);
                    info.modes.should.containEql(mode);
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
                    should.not.exist(err);
                    info.modes.should.not.containEql(mode);
                    cb();
                })
            ], done);
        });
    });

    it('SetCrtcConfig re-applying the current config should return Success', function(t, done) {
        randr.GetCrtcInfo(crtc, resources.config_timestamp, (err, info) => {
            should.not.exist(err);
            info.status.should.equal(0);
            // re-apply exactly what is already configured so nothing changes
            randr.SetCrtcConfig(crtc, info.timestamp, resources.config_timestamp,
                info.x, info.y, info.mode, info.rotation, info.output, (err, res) => {
                    should.not.exist(err);
                    res.status.should.equal(0);
                    done();
                });
        });
    });

    it('GetCrtcGamma/SetCrtcGamma should round-trip and restore', function(t, done) {
        randr.GetCrtcGammaSize(crtc, (err, size) => {
            if (err) {
                // no gamma support on this crtc: a controlled RANDR error is
                // still proof the request reached the server
                err.minorOpcode.should.equal(22);
                done();
                return true;
            }
            if (size === 0) return done(); // gamma not supported, nothing to set
            randr.GetCrtcGamma(crtc, (err, orig) => {
                should.not.exist(err);
                orig.size.should.equal(size);
                orig.red.length.should.equal(size);
                orig.green.length.should.equal(size);
                orig.blue.length.should.equal(size);
                const ramp = [];
                for (let i = 0; i < size; ++i)
                    ramp.push(Math.floor(i * 65535 / (size - 1)));
                randr.SetCrtcGamma(crtc, ramp, ramp, ramp);
                syncError(e => {
                    should.not.exist(e);
                    randr.GetCrtcGamma(crtc, (err, readBack) => {
                        should.not.exist(err);
                        readBack.red.should.eql(ramp);
                        readBack.green.should.eql(ramp);
                        readBack.blue.should.eql(ramp);
                        // restore what was there before (shared server!)
                        randr.SetCrtcGamma(crtc, orig.red, orig.green, orig.blue);
                        syncError(e => {
                            should.not.exist(e);
                            randr.GetCrtcGamma(crtc, (err, restored) => {
                                should.not.exist(err);
                                restored.red.should.eql(orig.red);
                                restored.green.should.eql(orig.green);
                                restored.blue.should.eql(orig.blue);
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
            should.not.exist(err);
            info.pendingTransform.should.eql(IDENTITY);
            info.currentTransform.should.eql(IDENTITY);
            info.hasTransforms.should.be.a.Boolean();
            info.pendingFilter.should.be.a.String();
            info.currentFilter.should.be.a.String();
            info.pendingParams.should.be.an.Array();
            info.currentParams.should.be.an.Array();
            done();
        });
    });

    it('SetCrtcTransform succeeds or yields BadValue when transforms are unsupported', function(t, done) {
        randr.GetCrtcTransform(crtc, (err, info) => {
            should.not.exist(err);
            // identity transform: a no-op even where transforms are supported
            randr.SetCrtcTransform(crtc, IDENTITY, '', []);
            syncError(e => {
                if (info.hasTransforms) {
                    should.not.exist(e);
                } else {
                    // Xvfb: crtc has no transform support -> controlled BadValue
                    should.exist(e);
                    e.error.should.equal(2);
                    e.minorOpcode.should.equal(26);
                    e.majorOpcode.should.equal(randr.majorOpcode);
                }
                done();
            });
        });
    });

    it('GetPanning should return the panning state', function(t, done) {
        randr.GetPanning(crtc, (err, panning) => {
            should.not.exist(err);
            panning.status.should.equal(0);
            ['left', 'top', 'width', 'height',
                'trackLeft', 'trackTop', 'trackWidth', 'trackHeight',
                'borderLeft', 'borderTop', 'borderRight', 'borderBottom'].forEach(f => {
                panning[f].should.be.a.Number();
            });
            done();
        });
    });

    it('SetPanning re-applying current state succeeds or yields a controlled RANDR error', function(t, done) {
        randr.GetPanning(crtc, (err, panning) => {
            should.not.exist(err);
            // re-apply the state just read so nothing actually changes
            randr.SetPanning(crtc, panning.timestamp, panning, (err, res) => {
                if (err) {
                    // Xvfb has no panning hook and answers with a RANDR error
                    err.error.should.be.aboveOrEqual(randr.firstError);
                    err.minorOpcode.should.equal(29);
                    err.majorOpcode.should.equal(randr.majorOpcode);
                    done();
                    return true;
                }
                res.status.should.equal(0);
                done();
            });
        });
    });

    it('SetOutputPrimary/GetOutputPrimary should round-trip and restore', function(t, done) {
        randr.GetOutputPrimary(root, (err, original) => {
            should.not.exist(err);
            randr.SetOutputPrimary(root, output);
            syncError(e => {
                should.not.exist(e);
                randr.GetOutputPrimary(root, (err, primary) => {
                    should.not.exist(err);
                    primary.should.equal(output);
                    // restore previous primary output (shared server!)
                    randr.SetOutputPrimary(root, original);
                    syncError(e => {
                        should.not.exist(e);
                        randr.GetOutputPrimary(root, (err, restored) => {
                            should.not.exist(err);
                            restored.should.equal(original);
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
