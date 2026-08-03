const x11 = require('../lib');
const should = require('should');

// GLX tests. Query-style requests work against any server advertising GLX;
// context creation and rendering additionally require indirect GLX contexts,
// which modern servers only allow when started with `+iglx` — those tests
// self-skip when the server refuses CreateContext.
//
// Robustness notes (X server GLX implementations vary in quality — ubuntu
// 24.04's Xvfb segfaults on indirect MakeCurrent, for example):
// - every reply callback is wrapped in guard(): an assertion throwing inside
//   the reply parser would corrupt the connection state and wedge all later
//   tests into their full timeout;
// - if the server dies mid-suite (ECONNRESET), remaining tests skip fast
//   instead of each waiting out the mocha timeout.

describe('GLX extension', function() {
    this.timeout(20000);

    // wrap a reply callback so assertion failures reach mocha via done()
    // without unwinding the X reply parser mid-read
    function guard(done, fn) {
        return function(...args) {
            try {
                return fn(...args);
            } catch (e) {
                done(e);
                return true;
            }
        };
    }

    before(function(done) {
        const self = this;
        self.connDead = false;
        let setupFinished = false;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.display = dpy;
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.X.on('end', () => { self.connDead = true; });
            self.X.require('glx', (err, ext) => {
                should.not.exist(err);
                self.GLX = ext;
                setupFinished = true;
                done();
            });
        });
        client.on('error', err => {
            if (!setupFinished) {
                setupFinished = true;
                return done(err);
            }
            // socket-level error after setup: the server is gone
            if (err && err.code)
                self.connDead = true;
        });
    });

    beforeEach(function() {
        if (this.connDead)
            this.skip();
    });

    after(function(done) {
        if (this.connDead || !this.X)
            return done();
        this.X.terminate();
        this.X.on('end', done);
    });

    it('QueryVersion should report at least GLX 1.2', function(done) {
        this.GLX.QueryVersion(1, 4, guard(done, (err, version) => {
            should.not.exist(err);
            version[0].should.equal(1);
            version[1].should.be.aboveOrEqual(2);
            done();
        }));
    });

    it('QueryServerString should return NUL-free vendor and version strings', function(done) {
        const GLX = this.GLX;
        GLX.QueryServerString(0, GLX.glxConst.VENDOR, guard(done, (err, vendor) => {
            should.not.exist(err);
            vendor.should.be.a.String();
            vendor.length.should.be.above(0);
            vendor.should.not.match(/\0/);
            GLX.QueryServerString(0, GLX.glxConst.VERSION, guard(done, (err, version) => {
                should.not.exist(err);
                version.should.match(/^1\.[2-9]/);
                done();
            }));
        }));
    });

    it('QueryExtensionsString should return a GLX extension list', function(done) {
        this.GLX.QueryExtensionsString(0, guard(done, (err, extensions) => {
            should.not.exist(err);
            extensions.should.match(/GLX_ARB_multisample/);
            extensions.should.not.match(/\0/);
            done();
        }));
    });

    it('GetVisualConfigs should decode base and extended properties', function(done) {
        const self = this;
        this.GLX.GetVisualConfigs(0, guard(done, (err, configs) => {
            should.not.exist(err);
            configs.should.be.an.Array();
            configs.length.should.be.above(0);
            const cfg = configs[0];
            cfg.should.have.property('visualID');
            cfg.should.have.property('rgbMode');
            cfg.should.have.property('doubleBufferMode');
            cfg.should.have.property('depthBits');
            // remember an RGBA double-buffered visual for the context tests
            self.visualConfig = configs.find(c =>
                c.rgbMode && c.doubleBufferMode && c.depthBits > 0);
            done();
        }));
    });

    it('GetFBConfigs should decode attributes by name', function(done) {
        const self = this;
        this.GLX.GetFBConfigs(0, guard(done, (err, configs) => {
            should.not.exist(err);
            configs.length.should.be.above(0);
            configs[0].should.have.property('FBCONFIG_ID');
            configs[0].should.have.property('RENDER_TYPE');
            configs[0].should.have.property('DRAWABLE_TYPE');
            // an fbconfig usable for both windows and pbuffers
            self.fbconfig = configs.find(c =>
                (c.DRAWABLE_TYPE & self.GLX.glxConst.WINDOW_BIT) &&
                (c.DRAWABLE_TYPE & self.GLX.glxConst.PBUFFER_BIT) &&
                (c.RENDER_TYPE & self.GLX.glxConst.RGBA_BIT) &&
                c.DOUBLEBUFFER && c.VISUAL_ID);
            done();
        }));
    });

    it('ChooseFBConfig should return matching configs sorted best-first', function(done) {
        const self = this;
        const C = this.GLX.glxConst;
        const spec = { RENDER_TYPE: C.RGBA_BIT, DRAWABLE_TYPE: C.WINDOW_BIT,
            RED_SIZE: 1, GREEN_SIZE: 1, BLUE_SIZE: 1, DOUBLEBUFFER: true };
        this.GLX.ChooseFBConfig(0, spec, guard(done, (err, chosen) => {
            should.not.exist(err);
            chosen.should.be.an.Array();
            chosen.length.should.be.above(0);
            // every returned config satisfies the request
            for (const c of chosen) {
                (c.RENDER_TYPE & C.RGBA_BIT).should.be.above(0);
                (c.DRAWABLE_TYPE & C.WINDOW_BIT).should.be.above(0);
                c.RED_SIZE.should.be.above(0);
                c.DOUBLEBUFFER.should.equal(1);
            }
            // the best config has no caveat and the deepest color available
            // among the matches (sort rules 1 and 2)
            const best = chosen[0];
            (best.CONFIG_CAVEAT === undefined ||
                best.CONFIG_CAVEAT === C.NONE).should.be.true();
            const colorBits = c => c.RED_SIZE + c.GREEN_SIZE + c.BLUE_SIZE;
            for (const c of chosen)
                colorBits(best).should.be.aboveOrEqual(colorBits(c));
            // results come from the server's fbconfig list
            self.GLX.GetFBConfigs(0, guard(done, (err2, all) => {
                should.not.exist(err2);
                const allIds = new Set(all.map(c => c.FBCONFIG_ID));
                for (const c of chosen)
                    allIds.has(c.FBCONFIG_ID).should.be.true();
                done();
            }));
        }));
    });

    it('ChooseFBConfig with an impossible spec should return an empty list', function(done) {
        this.GLX.ChooseFBConfig(0, { RED_SIZE: 1024 }, guard(done, (err, chosen) => {
            should.not.exist(err);
            chosen.should.be.an.Array();
            chosen.length.should.equal(0);
            done();
        }));
    });

    it('GetFBConfigsSGIX should agree with GetFBConfigs', function(done) {
        const self = this;
        this.GLX.GetFBConfigsSGIX(0, guard(done, (err, configs) => {
            should.not.exist(err);
            configs.length.should.be.above(0);
            configs[0].should.have.property('FBCONFIG_ID');
            self.GLX.GetFBConfigs(0, guard(done, (err, coreConfigs) => {
                should.not.exist(err);
                configs.length.should.equal(coreConfigs.length);
                done();
            }));
        }));
    });

    it('ClientInfo and SetClientInfoARB should be accepted by the server', function(done) {
        const GLX = this.GLX;
        GLX.ClientInfo(1, 4, 'GL_ARB_multisample');
        GLX.SetClientInfoARB(1, 4, [[1, 4], [2, 1]], 'GL_ARB_multisample', 'GLX_ARB_create_context');
        // round-trip to make sure neither request produced a protocol error
        GLX.QueryVersion(1, 4, guard(done, (err) => {
            should.not.exist(err);
            done();
        }));
    });

    // The callback is what makes "this server refuses indirect contexts"
    // diagnosable: every query request succeeds on such a server, so the
    // BadValue from CreateContext is the only signal, and without a callback
    // it arrives unattributed on client.on('error').
    it('CreateContext should report success or failure through its callback', function(done) {
        const GLX = this.GLX;
        if (!this.visualConfig || this.connDead)
            return this.skip();
        const probe = this.X.AllocID();
        GLX.CreateContext(probe, this.visualConfig.visualID, 0, 0, 0, guard(done, (err) => {
            if (!err)
                GLX.DestroyContext(probe);
            else {
                // BadValue (2), value 0: indirect GLX contexts disabled
                err.error.should.equal(2);
                err.majorOpcode.should.equal(GLX.majorOpcode);
                err.minorOpcode.should.equal(3);
                err.badParam.should.equal(0);
            }
            done();
            return true; // handled: keep it off client.on('error')
        }));
    });

    describe('indirect contexts', function() {
        // probe whether the server allows indirect GLX contexts; skip the
        // whole block otherwise (servers not started with +iglx). The
        // CreateContext callback is the direct answer — a server that
        // refuses indirect contexts fails it with BadValue, value 0
        before(function(done) {
            const self = this;
            const GLX = this.GLX;
            if (!this.visualConfig || this.connDead)
                return done();
            const probe = this.X.AllocID();
            GLX.CreateContext(probe, this.visualConfig.visualID, 0, 0, 0, (err) => {
                self.iglxError = err;
                self.hasIndirect = !err;
                if (!err)
                    GLX.DestroyContext(probe);
                done();
                return true; // consume the probe error, if any
            });
        });

        beforeEach(function() {
            if (!this.hasIndirect || this.connDead)
                this.skip();
        });

        it('CreateContext + MakeCurrent should return a context tag', function(done) {
            const self = this;
            const X = this.X;
            const GLX = this.GLX;
            const cfg = this.visualConfig;

            let depth = 24;
            const depths = this.display.screen[0].depths;
            for (const d in depths)
                if (Object.keys(depths[d]).indexOf(String(cfg.visualID)) !== -1)
                    depth = parseInt(d);

            const cmid = X.AllocID();
            X.CreateColormap(cmid, this.root, cfg.visualID, 0);
            const win = X.AllocID();
            X.CreateWindow(win, this.root, 0, 0, 64, 64, 0, depth, 1, cfg.visualID,
                { colormap: cmid, backgroundPixel: 0, borderPixel: 0,
                  eventMask: x11.eventMask.StructureNotify });
            X.MapWindow(win);
            self.win = win;

            X.once('event', () => {
                const ctx = X.AllocID();
                GLX.CreateContext(ctx, cfg.visualID, 0, 0, 0);
                self.ctx = ctx;
                GLX.MakeCurrent(win, ctx, 0, guard(done, (err, tag) => {
                    should.not.exist(err);
                    tag.should.be.above(0);
                    self.tag = tag;
                    // modern Linux X servers accept indirect contexts but no
                    // longer execute GL behind them (no rasterization, state
                    // queries return uninitialized garbage) - XQuartz's Xvfb
                    // still does. An empty GL_VERSION string is the reliable
                    // tell; detect it so GL-execution tests can skip.
                    GLX.GetString(tag, GLX.VERSION, guard(done, (err, version) => {
                        should.not.exist(err);
                        self.glExecutes = version.length > 0;
                        done();
                    }));
                }));
            });
        });

        // requests below exercise actual GL execution, not just GLX protocol
        function itGL(title, fn) {
            it(title, function(done) {
                if (!this.glExecutes)
                    return this.skip();
                fn.call(this, done);
            });
        }

        it('IsDirect should report false for an indirect context', function(done) {
            this.GLX.IsDirect(this.ctx, guard(done, (err, isDirect) => {
                should.not.exist(err);
                isDirect.should.equal(false);
                done();
            }));
        });

        it('QueryContext should report the context attributes', function(done) {
            const cfg = this.visualConfig;
            this.GLX.QueryContext(this.ctx, guard(done, (err, attribs) => {
                should.not.exist(err);
                attribs.should.have.property('VISUAL_ID', cfg.visualID);
                attribs.should.have.property('SCREEN', 0);
                done();
            }));
        });

        it('GetString should return GL strings', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            GLX.GetString(tag, GLX.VENDOR, guard(done, (err, vendor) => {
                should.not.exist(err);
                // some servers (e.g. debian bookworm Xvfb) return empty GL
                // strings to indirect contexts - only check the type then
                vendor.should.be.a.String();
                GLX.GetString(tag, GLX.VERSION, guard(done, (err, version) => {
                    should.not.exist(err);
                    version.should.be.a.String();
                    if (version.length)
                        version.should.match(/^\d+\.\d+/);
                    done();
                }));
            }));
        });

        itGL('GetIntegerv should return single values and arrays', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            GLX.GetIntegerv(tag, GLX.MAX_TEXTURE_SIZE, guard(done, (err, size) => {
                should.not.exist(err);
                size.should.be.a.Number();
                size.should.be.above(0);
                GLX.GetIntegerv(tag, 0x0BA2 /* GL_VIEWPORT */, guard(done, (err, viewport) => {
                    should.not.exist(err);
                    viewport.should.be.an.Array();
                    viewport.length.should.equal(4);
                    done();
                }));
            }));
        });

        itGL('GetFloatv and GetBooleanv should decode their types', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            GLX.GetFloatv(tag, 0x0B21 /* GL_LINE_WIDTH */, guard(done, (err, width) => {
                should.not.exist(err);
                width.should.be.a.Number();
                width.should.be.approximately(1, 0.001);
                GLX.GetBooleanv(tag, 0x0C32 /* GL_DOUBLEBUFFER */, guard(done, (err, doubleBuffered) => {
                    should.not.exist(err);
                    doubleBuffered.should.be.a.Boolean();
                    done();
                }));
            }));
        });

        itGL('IsEnabled should reflect Enable/Disable', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            const gl = GLX.renderPipeline(tag);
            GLX.IsEnabled(tag, GLX.DEPTH_TEST, guard(done, (err, enabled) => {
                should.not.exist(err);
                enabled.should.equal(false);
                gl.Enable(gl.DEPTH_TEST);
                gl.Render();
                GLX.IsEnabled(tag, GLX.DEPTH_TEST, guard(done, (err, enabled) => {
                    should.not.exist(err);
                    enabled.should.equal(true);
                    gl.Disable(gl.DEPTH_TEST);
                    gl.Render();
                    done();
                }));
            }));
        });

        itGL('rendered triangle should be readable via ReadPixels', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            const gl = GLX.renderPipeline(tag);

            gl.Viewport(0, 0, 64, 64);
            gl.MatrixMode(gl.PROJECTION);
            gl.LoadIdentity();
            gl.Ortho(-1, 1, -1, 1, -1, 1);
            gl.MatrixMode(gl.MODELVIEW);
            gl.LoadIdentity();
            gl.ClearColor(0, 0, 1, 1);
            gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.Begin(gl.TRIANGLES);
            gl.Color3f(1, 0, 0);
            gl.Vertex3f(0, 0.9, 0);
            gl.Vertex3f(-0.9, -0.9, 0);
            gl.Vertex3f(0.9, -0.9, 0);
            gl.End();
            gl.Render();

            GLX.Finish(tag, guard(done, err => {
                should.not.exist(err);
                GLX.ReadPixels(tag, 32, 32, 1, 1, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0, guard(done, (err, center) => {
                    should.not.exist(err);
                    center[0].should.be.above(200); // red
                    center[1].should.be.below(50);
                    center[2].should.be.below(50);
                    GLX.ReadPixels(tag, 0, 63, 1, 1, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0, guard(done, (err, corner) => {
                        should.not.exist(err);
                        corner[0].should.be.below(50); // blue
                        corner[2].should.be.above(200);
                        done();
                    }));
                }));
            }));
        });

        itGL('display lists: GenLists/NewList/EndList/IsList/DeleteLists', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            GLX.GenLists(tag, 2, guard(done, (err, base) => {
                should.not.exist(err);
                base.should.be.above(0);
                GLX.NewList(tag, base, GLX.COMPILE);
                const gl = GLX.renderPipeline(tag);
                gl.Begin(gl.POINTS);
                gl.Vertex3f(0, 0, 0);
                gl.End();
                gl.Render();
                GLX.EndList(tag);
                GLX.IsList(tag, base, guard(done, (err, isList) => {
                    should.not.exist(err);
                    isList.should.equal(true);
                    GLX.DeleteLists(tag, base, 2);
                    GLX.IsList(tag, base, guard(done, (err, isList) => {
                        should.not.exist(err);
                        isList.should.equal(false);
                        done();
                    }));
                }));
            }));
        });

        itGL('textures: GenTextures/IsTexture/AreTexturesResident/DeleteTextures', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            const gl = GLX.renderPipeline(tag);
            GLX.GenTextures(tag, 3, guard(done, (err, textures) => {
                should.not.exist(err);
                textures.length.should.equal(3);
                textures.forEach(t => t.should.be.above(0));
                // a texture id only becomes a texture once bound
                gl.BindTexture(gl.TEXTURE_2D, textures[0]);
                gl.Render();
                GLX.IsTexture(tag, textures[0], guard(done, (err, isTexture) => {
                    should.not.exist(err);
                    isTexture.should.equal(true);
                    GLX.AreTexturesResident(tag, [textures[0]], guard(done, (err, res) => {
                        should.not.exist(err);
                        res.should.have.property('allResident');
                        res.residences.length.should.equal(1);
                        GLX.DeleteTextures(tag, textures);
                        GLX.IsTexture(tag, textures[0], guard(done, (err, isTexture) => {
                            should.not.exist(err);
                            isTexture.should.equal(false);
                            done();
                        }));
                    }));
                }));
            }));
        });

        itGL('RenderMode should switch modes and report zero values', function(done) {
            const GLX = this.GLX;
            GLX.RenderMode(this.tag, GLX.RENDER, guard(done, (err, result) => {
                should.not.exist(err);
                // retval is the number of feedback/selection values generated
                // in the previous mode - zero when it was GL_RENDER
                result.retval.should.equal(0);
                result.newMode.should.equal(GLX.RENDER);
                result.data.should.be.an.Array();
                done();
            }));
        });

        it('PixelStorei, WaitGL, WaitX and Flush should not error', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            GLX.PixelStorei(tag, GLX.PACK_ALIGNMENT, 1);
            GLX.WaitGL(tag);
            GLX.WaitX(tag);
            GLX.Flush(tag);
            GLX.GetError(tag, guard(done, (err, glError) => {
                should.not.exist(err);
                glError.should.equal(0);
                done();
            }));
        });

        itGL('GetError should return GL_INVALID_ENUM after a bad command', function(done) {
            const GLX = this.GLX;
            const tag = this.tag;
            const gl = GLX.renderPipeline(tag);
            gl.Enable(0xdead); // not a valid GL capability
            gl.Render();
            GLX.GetError(tag, guard(done, (err, glError) => {
                should.not.exist(err);
                glError.should.equal(0x0500); // GL_INVALID_ENUM
                done();
            }));
        });

        it('errors should use GLX error names', function(done) {
            this.GLX.MakeCurrent(this.win, 0xbad0bad, 0, guard(done, (err) => {
                should.exist(err);
                err.message.should.equal('GLXBadContext');
                done();
                return true; // error handled, don't re-emit on the client
            }));
        });

        it('GLX 1.3: pbuffer + MakeContextCurrent + render round-trip', function(done) {
            const self = this;
            const X = this.X;
            const GLX = this.GLX;
            if (!this.fbconfig)
                return this.skip();

            const pbuffer = X.AllocID();
            GLX.CreatePbuffer(0, this.fbconfig.FBCONFIG_ID, pbuffer,
                [GLX.glxAttrib.PBUFFER_WIDTH, 32, GLX.glxAttrib.PBUFFER_HEIGHT, 32]);
            const ctx = X.AllocID();
            GLX.CreateNewContext(ctx, this.fbconfig.FBCONFIG_ID, 0, GLX.glxAttrib.RGBA_TYPE, 0, 0);
            // when another context is current its tag must be passed as
            // oldContextTag, otherwise the server raises GLXBadContext
            GLX.MakeContextCurrent(this.tag, pbuffer, pbuffer, ctx, guard(done, (err, tag) => {
                should.not.exist(err);
                tag.should.be.above(0);
                GLX.GetDrawableAttributes(pbuffer, guard(done, (err, attribs) => {
                    should.not.exist(err);
                    attribs.should.have.property('WIDTH', 32);
                    attribs.should.have.property('HEIGHT', 32);

                    // rebind the main window context, then clean up
                    function cleanup(tag) {
                        GLX.MakeCurrent(self.win, self.ctx, tag, guard(done, (err, newTag) => {
                            should.not.exist(err);
                            self.tag = newTag;
                            GLX.DestroyPbuffer(pbuffer);
                            GLX.DestroyContext(ctx);
                            self.GLX.QueryVersion(1, 4, guard(done, err => {
                                should.not.exist(err);
                                done();
                            }));
                        }));
                    }

                    // pixel round-trip needs a server that executes GL
                    if (!self.glExecutes)
                        return cleanup(tag);

                    const gl = GLX.renderPipeline(tag);
                    gl.Viewport(0, 0, 32, 32);
                    gl.ClearColor(0, 1, 0, 1);
                    gl.Clear(gl.COLOR_BUFFER_BIT);
                    gl.Render();
                    GLX.Finish(tag, guard(done, err => {
                        should.not.exist(err);
                        GLX.ReadPixels(tag, 16, 16, 1, 1, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0, guard(done, (err, px) => {
                            should.not.exist(err);
                            px[1].should.be.above(200); // green
                            cleanup(tag);
                        }));
                    }));
                }));
            }));
        });

        it('GLX 1.3: CreateWindow/DestroyWindow for a GLX window', function(done) {
            const X = this.X;
            const GLX = this.GLX;
            if (!this.fbconfig)
                return this.skip();

            const cfg = this.fbconfig;
            let depth = 24;
            const depths = this.display.screen[0].depths;
            for (const d in depths)
                if (Object.keys(depths[d]).indexOf(String(cfg.VISUAL_ID)) !== -1)
                    depth = parseInt(d);

            const cmid = X.AllocID();
            X.CreateColormap(cmid, this.root, cfg.VISUAL_ID, 0);
            const win = X.AllocID();
            X.CreateWindow(win, this.root, 0, 0, 32, 32, 0, depth, 1, cfg.VISUAL_ID,
                { colormap: cmid, backgroundPixel: 0, borderPixel: 0 });
            const glxwin = X.AllocID();
            GLX.CreateWindow(0, cfg.FBCONFIG_ID, win, glxwin, []);
            GLX.GetDrawableAttributes(glxwin, guard(done, (err, attribs) => {
                should.not.exist(err);
                attribs.should.have.property('FBCONFIG_ID', cfg.FBCONFIG_ID);
                GLX.DestroyWindow(glxwin);
                X.DestroyWindow(win);
                GLX.QueryVersion(1, 4, guard(done, err => {
                    should.not.exist(err);
                    done();
                }));
            }));
        });

        it('GLX_ARB_create_context: CreateContextAttribsARB', function(done) {
            const X = this.X;
            const GLX = this.GLX;
            if (!this.fbconfig)
                return this.skip();
            const ctx = X.AllocID();
            GLX.CreateContextAttribsARB(ctx, this.fbconfig.FBCONFIG_ID, 0, 0, 0,
                [GLX.glxAttrib.CONTEXT_MAJOR_VERSION_ARB, 1,
                 GLX.glxAttrib.CONTEXT_MINOR_VERSION_ARB, 0]);
            GLX.IsDirect(ctx, guard(done, (err, isDirect) => {
                should.not.exist(err);
                isDirect.should.equal(false);
                GLX.DestroyContext(ctx);
                done();
            }));
        });

        it('GLX_SGIX_fbconfig: CreateContextWithConfigSGIX', function(done) {
            const X = this.X;
            const GLX = this.GLX;
            if (!this.fbconfig)
                return this.skip();
            const ctx = X.AllocID();
            GLX.CreateContextWithConfigSGIX(ctx, this.fbconfig.FBCONFIG_ID, 0,
                GLX.glxAttrib.RGBA_TYPE, 0, 0);
            GLX.IsDirect(ctx, guard(done, (err, isDirect) => {
                should.not.exist(err);
                isDirect.should.equal(false);
                GLX.DestroyContext(ctx);
                done();
            }));
        });

        it('GLX_SGIX_pbuffer: create/query/destroy', function(done) {
            const X = this.X;
            const GLX = this.GLX;
            if (!this.fbconfig)
                return this.skip();
            const pbuffer = X.AllocID();
            GLX.CreateGLXPbufferSGIX(0, this.fbconfig.FBCONFIG_ID, pbuffer, 16, 16, []);
            GLX.GetDrawableAttributesSGIX(pbuffer, guard(done, (err, attribs) => {
                should.not.exist(err);
                attribs.should.have.property('WIDTH', 16);
                attribs.should.have.property('HEIGHT', 16);
                GLX.DestroyGLXPbufferSGIX(pbuffer);
                GLX.QueryVersion(1, 4, guard(done, err => {
                    should.not.exist(err);
                    done();
                }));
            }));
        });

        it('GLX_SGI_make_current_read: MakeCurrentReadSGI', function(done) {
            const self = this;
            const GLX = this.GLX;
            // rebind the main window context with separate read drawable
            GLX.MakeCurrentReadSGI(this.tag, this.win, this.win, this.ctx, guard(done, (err, tag) => {
                should.not.exist(err);
                tag.should.be.above(0);
                self.tag = tag;
                done();
            }));
        });

        after(function(done) {
            if (this.connDead || !this.ctx)
                return done();
            const GLX = this.GLX;
            // unbind and destroy the main test context
            GLX.MakeCurrent(0, 0, this.tag, () => {
                GLX.DestroyContext(this.ctx);
                if (this.win)
                    this.X.DestroyWindow(this.win);
                done();
                return true;
            });
        });
    });
});
