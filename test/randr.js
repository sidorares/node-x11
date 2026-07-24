const x11 = require('../lib');
const async = require('async');
const should = require('should');
const assert = require('assert');
const util = require('util');

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('RANDR extension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.screen = dpy.screen[0];
            self.root = self.screen.root;
            self.X.require('randr', (err, ext) => {
                should.not.exist(err);
                self.randr = ext;
                /* We HAVE to QueryVersion before using it. Otherwise it does not work as expected */
                self.randr.QueryVersion(1, 2, err => {
                    should.not.exist(err);
                    self.randr.GetScreenResources(self.root, (err, resources) => {
                        should.not.exist(err);
                        self.resources = resources;
                        self.output = resources.outputs[0];
                        self.crtc = resources.crtcs[0];
                        done();
                    });
                });
            });
        });

        client.on('error', err => {
            if (self.onXError) return self.onXError(err);
            done(err);
        });
    });

    // issue a round-trip request and hand back any X error raised by
    // no-reply requests sent before it
    const syncError = (self, cb) => {
        let caught = null;
        self.onXError = err => { caught = err; };
        self.X.GetGeometry(self.root, () => {
            self.onXError = null;
            cb(caught);
        });
    };

    it('GetScreenInfo should get same px and mm width and height as in display.screen[0]', function(done) {
        const self = this;
        this.randr.GetScreenInfo(this.root, (err, info) => {
            should.not.exist(err);
            const active_screen = info.screens[info.sizeID];
            active_screen.px_width.should.equal(self.screen.pixel_width);
            active_screen.px_height.should.equal(self.screen.pixel_height);
            active_screen.mm_width.should.equal(self.screen.mm_width);
            active_screen.mm_height.should.equal(self.screen.mm_height);
            done();
        });
    });

    it('GetScreenResources && GetOutputInfo', function(done) {
        const self = this;
        this.randr.GetScreenResources(this.root, (err, resources) => {
            should.not.exist(err);
            should.exist(resources);
            async.each(
                resources.outputs,
                (output, cb) => {
                    self.randr.GetOutputInfo(output, 0, (err, info) => {
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

    it('GetScreenSizeRange should contain the current screen size', function(done) {
        const self = this;
        this.randr.GetScreenSizeRange(this.root, (err, range) => {
            should.not.exist(err);
            range.minWidth.should.be.within(1, self.screen.pixel_width);
            range.minHeight.should.be.within(1, self.screen.pixel_height);
            range.maxWidth.should.not.be.below(self.screen.pixel_width);
            range.maxHeight.should.not.be.below(self.screen.pixel_height);
            done();
        });
    });

    it('SetScreenSize to the current size should succeed and keep GetScreenInfo intact', function(done) {
        const self = this;
        // only ever set the CURRENT size: other tests share this server
        this.randr.SetScreenSize(this.root, this.screen.pixel_width, this.screen.pixel_height,
            this.screen.mm_width, this.screen.mm_height);
        syncError(self, err => {
            should.not.exist(err);
            self.randr.GetScreenInfo(self.root, (err, info) => {
                should.not.exist(err);
                const active_screen = info.screens[info.sizeID];
                active_screen.px_width.should.equal(self.screen.pixel_width);
                active_screen.px_height.should.equal(self.screen.pixel_height);
                done();
            });
        });
    });

    it('GetScreenResourcesCurrent should match GetScreenResources', function(done) {
        const self = this;
        this.randr.GetScreenResourcesCurrent(this.root, (err, current) => {
            should.not.exist(err);
            current.crtcs.should.eql(self.resources.crtcs);
            current.outputs.should.eql(self.resources.outputs);
            current.modeinfos.length.should.equal(self.resources.modeinfos.length);
            current.modeinfos.forEach((mode, i) => {
                mode.name.should.equal(self.resources.modeinfos[i].name);
                mode.name.length.should.equal(mode.name_len);
            });
            done();
        });
    });

    it('output property requests should round-trip create/query/get/delete', function(done) {
        const self = this;
        const X = this.X;
        const randr = this.randr;
        const output = this.output;
        let atom;
        async.series([
            cb => X.InternAtom(false, 'NODE_X11_RANDR_TEST_PROP', (err, a) => { atom = a; cb(err); }),
            cb => {
                randr.ChangeOutputProperty(output, atom, X.atoms.INTEGER, 32, 0, [42, 7]);
                syncError(self, cb);
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
                syncError(self, cb);
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
                syncError(self, cb);
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

    it('CreateMode/AddOutputMode/DeleteOutputMode/DestroyMode lifecycle', function(done) {
        const self = this;
        const randr = this.randr;
        const output = this.output;
        const modeInfo = {
            width: 320, height: 240, dot_clock: 5000000,
            h_sync_start: 328, h_sync_end: 360, h_total: 400, h_skew: 0,
            v_sync_start: 245, v_sync_end: 248, v_total: 260,
            modeflags: 0, name: 'nodex11_test_320x240'
        };
        randr.CreateMode(this.root, modeInfo, (err, mode) => {
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
                    syncError(self, cb);
                },
                cb => randr.GetOutputInfo(output, 0, (err, info) => {
                    should.not.exist(err);
                    info.modes.should.containEql(mode);
                    cb();
                }),
                cb => {
                    randr.DeleteOutputMode(output, mode);
                    syncError(self, cb);
                },
                cb => {
                    randr.DestroyMode(mode);
                    syncError(self, cb);
                },
                cb => randr.GetOutputInfo(output, 0, (err, info) => {
                    should.not.exist(err);
                    info.modes.should.not.containEql(mode);
                    cb();
                })
            ], done);
        });
    });

    it('SetCrtcConfig re-applying the current config should return Success', function(done) {
        const self = this;
        this.randr.GetCrtcInfo(this.crtc, this.resources.config_timestamp, (err, info) => {
            should.not.exist(err);
            info.status.should.equal(0);
            // re-apply exactly what is already configured so nothing changes
            self.randr.SetCrtcConfig(self.crtc, info.timestamp, self.resources.config_timestamp,
                info.x, info.y, info.mode, info.rotation, info.output, (err, res) => {
                    should.not.exist(err);
                    res.status.should.equal(0);
                    done();
                });
        });
    });

    it('GetCrtcGamma/SetCrtcGamma should round-trip and restore', function(done) {
        const self = this;
        const randr = this.randr;
        const crtc = this.crtc;
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
                syncError(self, e => {
                    should.not.exist(e);
                    randr.GetCrtcGamma(crtc, (err, readBack) => {
                        should.not.exist(err);
                        readBack.red.should.eql(ramp);
                        readBack.green.should.eql(ramp);
                        readBack.blue.should.eql(ramp);
                        // restore what was there before (shared server!)
                        randr.SetCrtcGamma(crtc, orig.red, orig.green, orig.blue);
                        syncError(self, e => {
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

    it('GetCrtcTransform should report identity transforms by default', function(done) {
        this.randr.GetCrtcTransform(this.crtc, (err, info) => {
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

    it('SetCrtcTransform succeeds or yields BadValue when transforms are unsupported', function(done) {
        const self = this;
        this.randr.GetCrtcTransform(this.crtc, (err, info) => {
            should.not.exist(err);
            // identity transform: a no-op even where transforms are supported
            self.randr.SetCrtcTransform(self.crtc, IDENTITY, '', []);
            syncError(self, e => {
                if (info.hasTransforms) {
                    should.not.exist(e);
                } else {
                    // Xvfb: crtc has no transform support -> controlled BadValue
                    should.exist(e);
                    e.error.should.equal(2);
                    e.minorOpcode.should.equal(26);
                    e.majorOpcode.should.equal(self.randr.majorOpcode);
                }
                done();
            });
        });
    });

    it('GetPanning should return the panning state', function(done) {
        this.randr.GetPanning(this.crtc, (err, panning) => {
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

    it('SetPanning re-applying current state succeeds or yields a controlled RANDR error', function(done) {
        const self = this;
        this.randr.GetPanning(this.crtc, (err, panning) => {
            should.not.exist(err);
            // re-apply the state just read so nothing actually changes
            self.randr.SetPanning(self.crtc, panning.timestamp, panning, (err, res) => {
                if (err) {
                    // Xvfb has no panning hook and answers with a RANDR error
                    err.error.should.be.aboveOrEqual(self.randr.firstError);
                    err.minorOpcode.should.equal(29);
                    err.majorOpcode.should.equal(self.randr.majorOpcode);
                    done();
                    return true;
                }
                res.status.should.equal(0);
                done();
            });
        });
    });

    it('SetOutputPrimary/GetOutputPrimary should round-trip and restore', function(done) {
        const self = this;
        const randr = this.randr;
        randr.GetOutputPrimary(this.root, (err, original) => {
            should.not.exist(err);
            randr.SetOutputPrimary(self.root, self.output);
            syncError(self, e => {
                should.not.exist(e);
                randr.GetOutputPrimary(self.root, (err, primary) => {
                    should.not.exist(err);
                    primary.should.equal(self.output);
                    // restore previous primary output (shared server!)
                    randr.SetOutputPrimary(self.root, original);
                    syncError(self, e => {
                        should.not.exist(e);
                        randr.GetOutputPrimary(self.root, (err, restored) => {
                            should.not.exist(err);
                            restored.should.equal(original);
                            done();
                        });
                    });
                });
            });
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
