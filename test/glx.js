const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

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
//   instead of each waiting out its timeout.

describe('GLX extension', function() {
    let display, X, root, GLX, connDead, visualConfig, fbconfig;

    // wrap a reply callback so assertion failures reach the runner via done()
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

    before(function(t, done) {
        connDead = false;
        let setupFinished = false;
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            display = dpy;
            X = dpy.client;
            root = dpy.screen[0].root;
            X.on('end', () => { connDead = true; });
            X.require('glx', (err, ext) => {
                assert.ifError(err);
                GLX = ext;
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
                connDead = true;
        });
    });

    // A test runs its body even when a beforeEach skipped it, so each test
    // checks its precondition itself: `why()` names the reason to skip, if
    // any. Once the server has died every remaining test skips at once
    // instead of waiting out its timeout.
    function itIf(why, title, fn) {
        it(title, function(t, done) {
            const reason = why();
            if (reason) {
                t.skip(reason);
                return done();
            }
            fn(t, done);
        });
    }
    const serverGone = () => connDead && 'the X server is gone';

    after(function(t, done) {
        if (connDead || !X)
            return done();
        X.terminate();
        X.on('end', done);
    });

    itIf(serverGone, 'QueryVersion should report at least GLX 1.2', function(t, done) {
        GLX.QueryVersion(1, 4, guard(done, (err, version) => {
            assert.ifError(err);
            assert.strictEqual(version[0], 1);
            assert.ok(version[1] >= 2);
            done();
        }));
    });

    itIf(serverGone, 'QueryServerString should return NUL-free vendor and version strings', function(t, done) {
        GLX.QueryServerString(0, GLX.glxConst.VENDOR, guard(done, (err, vendor) => {
            assert.ifError(err);
            assert.strictEqual(typeof vendor, 'string');
            assert.ok(vendor.length > 0);
            assert.doesNotMatch(vendor, /\0/);
            GLX.QueryServerString(0, GLX.glxConst.VERSION, guard(done, (err, version) => {
                assert.ifError(err);
                assert.match(version, /^1\.[2-9]/);
                done();
            }));
        }));
    });

    itIf(serverGone, 'QueryExtensionsString should return a GLX extension list', function(t, done) {
        GLX.QueryExtensionsString(0, guard(done, (err, extensions) => {
            assert.ifError(err);
            assert.match(extensions, /GLX_ARB_multisample/);
            assert.doesNotMatch(extensions, /\0/);
            done();
        }));
    });

    itIf(serverGone, 'GetVisualConfigs should decode base and extended properties', function(t, done) {
        GLX.GetVisualConfigs(0, guard(done, (err, configs) => {
            assert.ifError(err);
            assert.ok(Array.isArray(configs));
            assert.ok(configs.length > 0);
            const cfg = configs[0];
            assert.ok('visualID' in cfg);
            assert.ok('rgbMode' in cfg);
            assert.ok('doubleBufferMode' in cfg);
            assert.ok('depthBits' in cfg);
            // remember an RGBA double-buffered visual for the context tests
            visualConfig = configs.find(c =>
                c.rgbMode && c.doubleBufferMode && c.depthBits > 0);
            done();
        }));
    });

    itIf(serverGone, 'GetFBConfigs should decode attributes by name', function(t, done) {
        GLX.GetFBConfigs(0, guard(done, (err, configs) => {
            assert.ifError(err);
            assert.ok(configs.length > 0);
            assert.ok('FBCONFIG_ID' in configs[0]);
            assert.ok('RENDER_TYPE' in configs[0]);
            assert.ok('DRAWABLE_TYPE' in configs[0]);
            // an fbconfig usable for both windows and pbuffers
            fbconfig = configs.find(c =>
                (c.DRAWABLE_TYPE & GLX.glxConst.WINDOW_BIT) &&
                (c.DRAWABLE_TYPE & GLX.glxConst.PBUFFER_BIT) &&
                (c.RENDER_TYPE & GLX.glxConst.RGBA_BIT) &&
                c.DOUBLEBUFFER && c.VISUAL_ID);
            done();
        }));
    });

    itIf(serverGone, 'ChooseFBConfig should return matching configs sorted best-first', function(t, done) {
        const C = GLX.glxConst;
        const spec = { RENDER_TYPE: C.RGBA_BIT, DRAWABLE_TYPE: C.WINDOW_BIT,
            RED_SIZE: 1, GREEN_SIZE: 1, BLUE_SIZE: 1, DOUBLEBUFFER: true };
        GLX.ChooseFBConfig(0, spec, guard(done, (err, chosen) => {
            assert.ifError(err);
            assert.ok(Array.isArray(chosen));
            assert.ok(chosen.length > 0);
            // every returned config satisfies the request
            for (const c of chosen) {
                assert.ok((c.RENDER_TYPE & C.RGBA_BIT) > 0);
                assert.ok((c.DRAWABLE_TYPE & C.WINDOW_BIT) > 0);
                assert.ok(c.RED_SIZE > 0);
                assert.strictEqual(c.DOUBLEBUFFER, 1);
            }
            // the best config has no caveat and the deepest color available
            // among the matches (sort rules 1 and 2)
            const best = chosen[0];
            assert.ok(best.CONFIG_CAVEAT === undefined ||
                best.CONFIG_CAVEAT === C.NONE);
            const colorBits = c => c.RED_SIZE + c.GREEN_SIZE + c.BLUE_SIZE;
            for (const c of chosen)
                assert.ok(colorBits(best) >= colorBits(c));
            // results come from the server's fbconfig list
            GLX.GetFBConfigs(0, guard(done, (err2, all) => {
                assert.ifError(err2);
                const allIds = new Set(all.map(c => c.FBCONFIG_ID));
                for (const c of chosen)
                    assert.strictEqual(allIds.has(c.FBCONFIG_ID), true);
                done();
            }));
        }));
    });

    itIf(serverGone, 'ChooseFBConfig with an impossible spec should return an empty list', function(t, done) {
        GLX.ChooseFBConfig(0, { RED_SIZE: 1024 }, guard(done, (err, chosen) => {
            assert.ifError(err);
            assert.ok(Array.isArray(chosen));
            assert.strictEqual(chosen.length, 0);
            done();
        }));
    });

    itIf(serverGone, 'GetFBConfigsSGIX should agree with GetFBConfigs', function(t, done) {
        GLX.GetFBConfigsSGIX(0, guard(done, (err, configs) => {
            assert.ifError(err);
            assert.ok(configs.length > 0);
            assert.ok('FBCONFIG_ID' in configs[0]);
            GLX.GetFBConfigs(0, guard(done, (err, coreConfigs) => {
                assert.ifError(err);
                assert.strictEqual(configs.length, coreConfigs.length);
                done();
            }));
        }));
    });

    itIf(serverGone, 'ClientInfo and SetClientInfoARB should be accepted by the server', function(t, done) {
        GLX.ClientInfo(1, 4, 'GL_ARB_multisample');
        GLX.SetClientInfoARB(1, 4, [[1, 4], [2, 1]], 'GL_ARB_multisample', 'GLX_ARB_create_context');
        // round-trip to make sure neither request produced a protocol error
        GLX.QueryVersion(1, 4, guard(done, (err) => {
            assert.ifError(err);
            done();
        }));
    });

    // The callback is what makes "this server refuses indirect contexts"
    // diagnosable: every query request succeeds on such a server, so the
    // BadValue from CreateContext is the only signal, and without a callback
    // it arrives unattributed on client.on('error').
    itIf(serverGone, 'CreateContext should report success or failure through its callback', function(t, done) {
        if (!visualConfig || connDead) {
            t.skip();
            return done();
        }
        const probe = X.AllocID();
        GLX.CreateContext(probe, visualConfig.visualID, 0, 0, 0, guard(done, (err) => {
            if (!err)
                GLX.DestroyContext(probe);
            else {
                // BadValue (2), value 0: indirect GLX contexts disabled
                assert.strictEqual(err.error, 2);
                assert.strictEqual(err.majorOpcode, GLX.majorOpcode);
                assert.strictEqual(err.minorOpcode, 3);
                assert.strictEqual(err.badParam, 0);
            }
            done();
            return true; // handled: keep it off client.on('error')
        }));
    });

    describe('indirect contexts', function() {
        // the main window, context and tag the first test sets up
        let hasIndirect, glExecutes, win, ctx, tag;

        // probe whether the server allows indirect GLX contexts; skip the
        // whole block otherwise (servers not started with +iglx). The
        // CreateContext callback is the direct answer — a server that
        // refuses indirect contexts fails it with BadValue, value 0
        before(function(t, done) {
            if (!visualConfig || connDead)
                return done();
            const probe = X.AllocID();
            GLX.CreateContext(probe, visualConfig.visualID, 0, 0, 0, (err) => {
                hasIndirect = !err;
                if (!err)
                    GLX.DestroyContext(probe);
                done();
                return true; // consume the probe error, if any
            });
        });

        const noIndirect = () => serverGone() ||
            (!hasIndirect && 'the server refuses indirect GLX contexts (start it with +iglx)');
        // requests that exercise actual GL execution, not just GLX protocol
        const noGL = () => noIndirect() ||
            (!glExecutes && 'the server does not execute GL behind indirect contexts');

        itIf(noIndirect, 'CreateContext + MakeCurrent should return a context tag', function(t, done) {
            const cfg = visualConfig;

            let depth = 24;
            const depths = display.screen[0].depths;
            for (const d in depths)
                if (Object.keys(depths[d]).indexOf(String(cfg.visualID)) !== -1)
                    depth = parseInt(d);

            const cmid = X.AllocID();
            X.CreateColormap(cmid, root, cfg.visualID, 0);
            win = X.AllocID();
            X.CreateWindow(win, root, 0, 0, 64, 64, 0, depth, 1, cfg.visualID,
                { colormap: cmid, backgroundPixel: 0, borderPixel: 0,
                  eventMask: x11.eventMask.StructureNotify });
            X.MapWindow(win);

            X.once('event', () => {
                ctx = X.AllocID();
                GLX.CreateContext(ctx, cfg.visualID, 0, 0, 0);
                GLX.MakeCurrent(win, ctx, 0, guard(done, (err, newTag) => {
                    assert.ifError(err);
                    assert.ok(newTag > 0);
                    tag = newTag;
                    // modern Linux X servers accept indirect contexts but no
                    // longer execute GL behind them (no rasterization, state
                    // queries return uninitialized garbage) - XQuartz's Xvfb
                    // still does. An empty GL_VERSION string is the reliable
                    // tell; detect it so GL-execution tests can skip.
                    GLX.GetString(tag, GLX.VERSION, guard(done, (err, version) => {
                        assert.ifError(err);
                        glExecutes = version.length > 0;
                        done();
                    }));
                }));
            });
        });

        itIf(noIndirect, 'IsDirect should report false for an indirect context', function(t, done) {
            GLX.IsDirect(ctx, guard(done, (err, isDirect) => {
                assert.ifError(err);
                assert.strictEqual(isDirect, false);
                done();
            }));
        });

        itIf(noIndirect, 'QueryContext should report the context attributes', function(t, done) {
            const cfg = visualConfig;
            GLX.QueryContext(ctx, guard(done, (err, attribs) => {
                assert.ifError(err);
                assert.strictEqual(attribs.VISUAL_ID, cfg.visualID);
                assert.strictEqual(attribs.SCREEN, 0);
                done();
            }));
        });

        itIf(noIndirect, 'GetString should return GL strings', function(t, done) {
            GLX.GetString(tag, GLX.VENDOR, guard(done, (err, vendor) => {
                assert.ifError(err);
                // some servers (e.g. debian bookworm Xvfb) return empty GL
                // strings to indirect contexts - only check the type then
                assert.strictEqual(typeof vendor, 'string');
                GLX.GetString(tag, GLX.VERSION, guard(done, (err, version) => {
                    assert.ifError(err);
                    assert.strictEqual(typeof version, 'string');
                    if (version.length)
                        assert.match(version, /^\d+\.\d+/);
                    done();
                }));
            }));
        });

        itIf(noGL, 'GetIntegerv should return single values and arrays', function(t, done) {
            GLX.GetIntegerv(tag, GLX.MAX_TEXTURE_SIZE, guard(done, (err, size) => {
                assert.ifError(err);
                assert.strictEqual(typeof size, 'number');
                assert.ok(size > 0);
                GLX.GetIntegerv(tag, 0x0BA2 /* GL_VIEWPORT */, guard(done, (err, viewport) => {
                    assert.ifError(err);
                    assert.ok(Array.isArray(viewport));
                    assert.strictEqual(viewport.length, 4);
                    done();
                }));
            }));
        });

        itIf(noGL, 'GetFloatv and GetBooleanv should decode their types', function(t, done) {
            GLX.GetFloatv(tag, 0x0B21 /* GL_LINE_WIDTH */, guard(done, (err, width) => {
                assert.ifError(err);
                assert.strictEqual(typeof width, 'number');
                assert.ok(Math.abs(width - 1) <= 0.001);
                GLX.GetBooleanv(tag, 0x0C32 /* GL_DOUBLEBUFFER */, guard(done, (err, doubleBuffered) => {
                    assert.ifError(err);
                    assert.strictEqual(typeof doubleBuffered, 'boolean');
                    done();
                }));
            }));
        });

        itIf(noGL, 'IsEnabled should reflect Enable/Disable', function(t, done) {
            const gl = GLX.renderPipeline(tag);
            GLX.IsEnabled(tag, GLX.DEPTH_TEST, guard(done, (err, enabled) => {
                assert.ifError(err);
                assert.strictEqual(enabled, false);
                gl.Enable(gl.DEPTH_TEST);
                gl.Render();
                GLX.IsEnabled(tag, GLX.DEPTH_TEST, guard(done, (err, enabled) => {
                    assert.ifError(err);
                    assert.strictEqual(enabled, true);
                    gl.Disable(gl.DEPTH_TEST);
                    gl.Render();
                    done();
                }));
            }));
        });

        itIf(noGL, 'rendered triangle should be readable via ReadPixels', function(t, done) {
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
                assert.ifError(err);
                GLX.ReadPixels(tag, 32, 32, 1, 1, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0, guard(done, (err, center) => {
                    assert.ifError(err);
                    assert.ok(center[0] > 200); // red
                    assert.ok(center[1] < 50);
                    assert.ok(center[2] < 50);
                    GLX.ReadPixels(tag, 0, 63, 1, 1, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0, guard(done, (err, corner) => {
                        assert.ifError(err);
                        assert.ok(corner[0] < 50); // blue
                        assert.ok(corner[2] > 200);
                        done();
                    }));
                }));
            }));
        });

        itIf(noGL, 'display lists: GenLists/NewList/EndList/IsList/DeleteLists', function(t, done) {
            GLX.GenLists(tag, 2, guard(done, (err, base) => {
                assert.ifError(err);
                assert.ok(base > 0);
                GLX.NewList(tag, base, GLX.COMPILE);
                const gl = GLX.renderPipeline(tag);
                gl.Begin(gl.POINTS);
                gl.Vertex3f(0, 0, 0);
                gl.End();
                gl.Render();
                GLX.EndList(tag);
                GLX.IsList(tag, base, guard(done, (err, isList) => {
                    assert.ifError(err);
                    assert.strictEqual(isList, true);
                    GLX.DeleteLists(tag, base, 2);
                    GLX.IsList(tag, base, guard(done, (err, isList) => {
                        assert.ifError(err);
                        assert.strictEqual(isList, false);
                        done();
                    }));
                }));
            }));
        });

        itIf(noGL, 'textures: GenTextures/IsTexture/AreTexturesResident/DeleteTextures', function(t, done) {
            const gl = GLX.renderPipeline(tag);
            GLX.GenTextures(tag, 3, guard(done, (err, textures) => {
                assert.ifError(err);
                assert.strictEqual(textures.length, 3);
                textures.forEach(t => assert.ok(t > 0));
                // a texture id only becomes a texture once bound
                gl.BindTexture(gl.TEXTURE_2D, textures[0]);
                gl.Render();
                GLX.IsTexture(tag, textures[0], guard(done, (err, isTexture) => {
                    assert.ifError(err);
                    assert.strictEqual(isTexture, true);
                    GLX.AreTexturesResident(tag, [textures[0]], guard(done, (err, res) => {
                        assert.ifError(err);
                        assert.ok('allResident' in res);
                        assert.strictEqual(res.residences.length, 1);
                        GLX.DeleteTextures(tag, textures);
                        GLX.IsTexture(tag, textures[0], guard(done, (err, isTexture) => {
                            assert.ifError(err);
                            assert.strictEqual(isTexture, false);
                            done();
                        }));
                    }));
                }));
            }));
        });

        itIf(noGL, 'RenderMode should switch modes and report zero values', function(t, done) {
            GLX.RenderMode(tag, GLX.RENDER, guard(done, (err, result) => {
                assert.ifError(err);
                // retval is the number of feedback/selection values generated
                // in the previous mode - zero when it was GL_RENDER
                assert.strictEqual(result.retval, 0);
                assert.strictEqual(result.newMode, GLX.RENDER);
                assert.ok(Array.isArray(result.data));
                done();
            }));
        });

        itIf(noIndirect, 'PixelStorei, WaitGL, WaitX and Flush should not error', function(t, done) {
            GLX.PixelStorei(tag, GLX.PACK_ALIGNMENT, 1);
            GLX.WaitGL(tag);
            GLX.WaitX(tag);
            GLX.Flush(tag);
            GLX.GetError(tag, guard(done, (err, glError) => {
                assert.ifError(err);
                assert.strictEqual(glError, 0);
                done();
            }));
        });

        itIf(noGL, 'GetError should return GL_INVALID_ENUM after a bad command', function(t, done) {
            const gl = GLX.renderPipeline(tag);
            gl.Enable(0xdead); // not a valid GL capability
            gl.Render();
            GLX.GetError(tag, guard(done, (err, glError) => {
                assert.ifError(err);
                assert.strictEqual(glError, 0x0500); // GL_INVALID_ENUM
                done();
            }));
        });

        itIf(noIndirect, 'errors should use GLX error names', function(t, done) {
            GLX.MakeCurrent(win, 0xbad0bad, 0, guard(done, (err) => {
                assert.ok(err != null);
                assert.strictEqual(err.message, 'GLXBadContext');
                done();
                return true; // error handled, don't re-emit on the client
            }));
        });

        itIf(noIndirect, 'GLX 1.3: pbuffer + MakeContextCurrent + render round-trip', function(t, done) {
            if (!fbconfig) {
                t.skip();
                return done();
            }

            const pbuffer = X.AllocID();
            GLX.CreatePbuffer(0, fbconfig.FBCONFIG_ID, pbuffer,
                [GLX.glxAttrib.PBUFFER_WIDTH, 32, GLX.glxAttrib.PBUFFER_HEIGHT, 32]);
            const pbCtx = X.AllocID();
            GLX.CreateNewContext(pbCtx, fbconfig.FBCONFIG_ID, 0, GLX.glxAttrib.RGBA_TYPE, 0, 0);
            // when another context is current its tag must be passed as
            // oldContextTag, otherwise the server raises GLXBadContext
            GLX.MakeContextCurrent(tag, pbuffer, pbuffer, pbCtx, guard(done, (err, pbTag) => {
                assert.ifError(err);
                assert.ok(pbTag > 0);
                GLX.GetDrawableAttributes(pbuffer, guard(done, (err, attribs) => {
                    assert.ifError(err);
                    assert.strictEqual(attribs.WIDTH, 32);
                    assert.strictEqual(attribs.HEIGHT, 32);

                    // rebind the main window context, then clean up
                    function cleanup() {
                        GLX.MakeCurrent(win, ctx, pbTag, guard(done, (err, newTag) => {
                            assert.ifError(err);
                            tag = newTag;
                            GLX.DestroyPbuffer(pbuffer);
                            GLX.DestroyContext(pbCtx);
                            GLX.QueryVersion(1, 4, guard(done, err => {
                                assert.ifError(err);
                                done();
                            }));
                        }));
                    }

                    // pixel round-trip needs a server that executes GL
                    if (!glExecutes)
                        return cleanup();

                    const gl = GLX.renderPipeline(pbTag);
                    gl.Viewport(0, 0, 32, 32);
                    gl.ClearColor(0, 1, 0, 1);
                    gl.Clear(gl.COLOR_BUFFER_BIT);
                    gl.Render();
                    GLX.Finish(pbTag, guard(done, err => {
                        assert.ifError(err);
                        GLX.ReadPixels(pbTag, 16, 16, 1, 1, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0, guard(done, (err, px) => {
                            assert.ifError(err);
                            assert.ok(px[1] > 200); // green
                            cleanup();
                        }));
                    }));
                }));
            }));
        });

        itIf(noIndirect, 'GLX 1.3: CreateWindow/DestroyWindow for a GLX window', function(t, done) {
            if (!fbconfig) {
                t.skip();
                return done();
            }

            const cfg = fbconfig;
            let depth = 24;
            const depths = display.screen[0].depths;
            for (const d in depths)
                if (Object.keys(depths[d]).indexOf(String(cfg.VISUAL_ID)) !== -1)
                    depth = parseInt(d);

            const cmid = X.AllocID();
            X.CreateColormap(cmid, root, cfg.VISUAL_ID, 0);
            const win = X.AllocID();
            X.CreateWindow(win, root, 0, 0, 32, 32, 0, depth, 1, cfg.VISUAL_ID,
                { colormap: cmid, backgroundPixel: 0, borderPixel: 0 });
            const glxwin = X.AllocID();
            GLX.CreateWindow(0, cfg.FBCONFIG_ID, win, glxwin, []);
            GLX.GetDrawableAttributes(glxwin, guard(done, (err, attribs) => {
                assert.ifError(err);
                assert.strictEqual(attribs.FBCONFIG_ID, cfg.FBCONFIG_ID);
                GLX.DestroyWindow(glxwin);
                X.DestroyWindow(win);
                GLX.QueryVersion(1, 4, guard(done, err => {
                    assert.ifError(err);
                    done();
                }));
            }));
        });

        itIf(noIndirect, 'GLX_ARB_create_context: CreateContextAttribsARB', function(t, done) {
            if (!fbconfig) {
                t.skip();
                return done();
            }
            const ctx = X.AllocID();
            GLX.CreateContextAttribsARB(ctx, fbconfig.FBCONFIG_ID, 0, 0, 0,
                [GLX.glxAttrib.CONTEXT_MAJOR_VERSION_ARB, 1,
                 GLX.glxAttrib.CONTEXT_MINOR_VERSION_ARB, 0]);
            GLX.IsDirect(ctx, guard(done, (err, isDirect) => {
                assert.ifError(err);
                assert.strictEqual(isDirect, false);
                GLX.DestroyContext(ctx);
                done();
            }));
        });

        itIf(noIndirect, 'GLX_SGIX_fbconfig: CreateContextWithConfigSGIX', function(t, done) {
            if (!fbconfig) {
                t.skip();
                return done();
            }
            const ctx = X.AllocID();
            GLX.CreateContextWithConfigSGIX(ctx, fbconfig.FBCONFIG_ID, 0,
                GLX.glxAttrib.RGBA_TYPE, 0, 0);
            GLX.IsDirect(ctx, guard(done, (err, isDirect) => {
                assert.ifError(err);
                assert.strictEqual(isDirect, false);
                GLX.DestroyContext(ctx);
                done();
            }));
        });

        itIf(noIndirect, 'GLX_SGIX_pbuffer: create/query/destroy', function(t, done) {
            if (!fbconfig) {
                t.skip();
                return done();
            }
            const pbuffer = X.AllocID();
            GLX.CreateGLXPbufferSGIX(0, fbconfig.FBCONFIG_ID, pbuffer, 16, 16, []);
            GLX.GetDrawableAttributesSGIX(pbuffer, guard(done, (err, attribs) => {
                assert.ifError(err);
                assert.strictEqual(attribs.WIDTH, 16);
                assert.strictEqual(attribs.HEIGHT, 16);
                GLX.DestroyGLXPbufferSGIX(pbuffer);
                GLX.QueryVersion(1, 4, guard(done, err => {
                    assert.ifError(err);
                    done();
                }));
            }));
        });

        itIf(noIndirect, 'GLX_SGI_make_current_read: MakeCurrentReadSGI', function(t, done) {
            // rebind the main window context with separate read drawable
            GLX.MakeCurrentReadSGI(tag, win, win, ctx, guard(done, (err, newTag) => {
                assert.ifError(err);
                assert.ok(newTag > 0);
                tag = newTag;
                done();
            }));
        });

        after(function(t, done) {
            if (connDead || !ctx)
                return done();
            // unbind and destroy the main test context
            GLX.MakeCurrent(0, 0, tag, () => {
                GLX.DestroyContext(ctx);
                if (win)
                    X.DestroyWindow(win);
                done();
                return true;
            });
        });
    });
});
