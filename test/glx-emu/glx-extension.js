// GLX extension tests: full request/reply round trips using the REAL
// client-side encoders and reply parsers (lib/ext/glx.js) looped straight
// back into the extension's handleRequest - no X server, no sockets. The
// fake `client` object implements the sendReply/sendError contract
// documented in browser/glx/glx-extension.js.
const assert = require('assert');
const glxClient = require('../../lib/ext/glx');
const { createGlxExtension, RecordingBackend } = require('../../browser/glx');

const VISUAL_ID = 0x99;

function createRig(done) {
    const backend = new RecordingBackend();
    const surfaces = new Map();
    const swaps = [];
    const ext = createGlxExtension({
        backend: backend,
        visualId: VISUAL_ID,
        getDrawableSurface: xid => surfaces.get(xid) || null
    });
    // what the server extension framework would assign before init()
    ext.majorOpcode = 156;
    ext.firstEvent = 90;
    ext.firstError = 160;
    ext.init(null);

    const errors = []; // errors for requests with no reply handler
    let pending = [];
    const X = {
        seq_num: 0,
        replies: {},
        errorParsers: {},
        eventParsers: {},
        pack_stream: {
            put(buf) {
                pending.push(buf);
            },
            submit() {
                if (pending.length === 0)
                    return;
                const req = Buffer.concat(pending);
                pending = [];
                const seq = X.seq_num;
                const client = {
                    sendReply(data) {
                        const handler = X.replies[seq];
                        if (!handler)
                            return;
                        delete X.replies[seq];
                        handler[1](null, handler[0](data));
                    },
                    sendError(code, value, majorOpcode, minorOpcode) {
                        const err = new Error('unknown');
                        err.error = code;
                        err.value = value;
                        err.majorOpcode = majorOpcode;
                        err.minorOpcode = minorOpcode;
                        const parser = X.errorParsers[code];
                        if (parser)
                            parser(err);
                        const handler = X.replies[seq];
                        if (handler) {
                            delete X.replies[seq];
                            handler[1](err);
                        } else {
                            errors.push(err);
                        }
                    }
                };
                ext.handleRequest(client, req[1], req.slice(4));
            }
        },
        QueryExtension(name, cb) {
            assert.strictEqual(name, 'GLX');
            cb(null, {
                present: true,
                majorOpcode: ext.majorOpcode,
                firstEvent: ext.firstEvent,
                firstError: ext.firstError
            });
        }
    };

    const rig = { backend, surfaces, swaps, ext, errors, X };
    rig.addSurface = (xid, width, height) => {
        surfaces.set(xid, {
            width: width,
            height: height,
            notifySwap(pixels) {
                swaps.push({ xid: xid, pixels: pixels });
            }
        });
    };
    glxClient.requireExt({ client: X }, (err, GLX) => {
        assert.ifError(err);
        rig.GLX = GLX;
        done(rig);
    });
    return rig;
}

describe('glx-emu GLX extension (loopback with the real client)', () => {
    let rig, GLX;

    beforeEach(done => {
        createRig(r => {
            rig = r;
            GLX = r.GLX;
            done();
        });
    });

    it('answers QueryVersion with 1.4', done => {
        GLX.QueryVersion(1, 4, (err, version) => {
            assert.ifError(err);
            assert.deepStrictEqual(version, [1, 4]);
            done();
        });
    });

    it('answers the GLX string queries', done => {
        GLX.QueryExtensionsString(0, (err, extensions) => {
            assert.ifError(err);
            assert.ok(extensions.includes('GLX_SGIX_pbuffer'));
            assert.ok(extensions.includes('GLX_ARB_create_context'));
            GLX.QueryServerString(0, GLX.glxConst.VENDOR, (err, vendor) => {
                assert.ifError(err);
                assert.strictEqual(vendor, 'node-x11');
                GLX.QueryServerString(0, GLX.glxConst.VERSION, (err, version) => {
                    assert.ifError(err);
                    assert.strictEqual(version, '1.4');
                    done();
                });
            });
        });
    });

    it('advertises a visual config the opengl examples accept', done => {
        GLX.GetVisualConfigs(0, (err, configs) => {
            assert.ifError(err);
            assert.strictEqual(configs.length, 1);
            const cfg = configs[0];
            assert.strictEqual(cfg.visualID, VISUAL_ID);
            // the exact predicates used by examples/opengl/*.js
            assert.ok(cfg.rgbMode && cfg.doubleBufferMode);                     // triangle
            assert.ok(cfg.rgbMode && cfg.doubleBufferMode && cfg.depthBits > 0); // glxgears/teapot
            assert.ok(cfg.depthBits > 0 && cfg.stencilBits > 0);                // reflection-shadow
            done();
        });
    });

    it('advertises an fbconfig the pbuffer example accepts', done => {
        GLX.GetFBConfigs(0, (err, configs) => {
            assert.ifError(err);
            assert.strictEqual(configs.length, 1);
            const cfg = configs[0];
            // the predicate used by examples/opengl/pbuffer-interop.js
            assert.ok(cfg.DRAWABLE_TYPE & GLX.glxConst.PBUFFER_BIT);
            assert.ok(cfg.RENDER_TYPE & GLX.glxConst.RGBA_BIT);
            assert.ok(cfg.DEPTH_SIZE > 0);
            assert.strictEqual(cfg.VISUAL_ID, VISUAL_ID);
            assert.ok(cfg.FBCONFIG_ID);
            done();
        });
    });

    it('CreateContext + MakeCurrent yields a context tag and sizes the backend', done => {
        rig.addSurface(0x600001, 400, 300);
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.MakeCurrent(0x600001, 0x300001, 0, (err, tag) => {
            assert.ifError(err);
            assert.ok(tag > 0);
            assert.deepStrictEqual(rig.backend.calls, [['resize', 400, 300]]);
            GLX.IsDirect(0x300001, (err, isDirect) => {
                assert.ifError(err);
                assert.strictEqual(isDirect, false);
                done();
            });
        });
    });

    it('MakeCurrent on an unknown context fails with GLXBadContext', done => {
        GLX.MakeCurrent(0x600001, 0xdead, 0, err => {
            assert.ok(err);
            assert.strictEqual(err.message, 'GLXBadContext');
            done();
        });
    });

    it('renders through the pipeline into the backend and swaps', done => {
        rig.addSurface(0x600001, 8, 4);
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.MakeCurrent(0x600001, 0x300001, 0, (err, tag) => {
            assert.ifError(err);
            const gl = GLX.renderPipeline(tag);
            gl.Viewport(0, 0, 8, 4);
            gl.ClearColor(0.2, 0.2, 0.2, 1);
            gl.Clear(gl.COLOR_BUFFER_BIT);
            gl.Begin(gl.TRIANGLES);
            gl.Color3f(1, 0, 0);
            gl.Vertex3f(0, 0.8, 0);
            gl.Color3f(0, 1, 0);
            gl.Vertex3f(-0.8, -0.8, 0);
            gl.Color3f(0, 0, 1);
            gl.Vertex3f(0.8, -0.8, 0);
            gl.End();
            gl.Render();
            gl.SwapBuffers(0x600001);
            const names = rig.backend.calls.map(c => c[0]);
            assert.deepStrictEqual(names, [
                'resize', 'viewport', 'clearColor', 'clear',
                'begin', 'color', 'vertex', 'color', 'vertex', 'color', 'vertex',
                'end', 'finish', 'readPixelsUint32'
            ]);
            assert.strictEqual(rig.swaps.length, 1);
            assert.strictEqual(rig.swaps[0].xid, 0x600001);
            assert.ok(rig.swaps[0].pixels instanceof Uint32Array);
            assert.strictEqual(rig.swaps[0].pixels.length, 8 * 4);
            assert.deepStrictEqual(rig.errors, []);
            done();
        });
    });

    it('Render with a bogus context tag raises GLXBadContextTag', done => {
        const gl = GLX.renderPipeline(12345);
        gl.Begin(gl.TRIANGLES);
        gl.End();
        gl.Render();
        assert.strictEqual(rig.errors.length, 1);
        assert.strictEqual(rig.errors[0].message, 'GLXBadContextTag');
        assert.deepStrictEqual(rig.backend.calls, []);
        done();
    });

    it('runs the glxgears display-list setup end to end', done => {
        rig.addSurface(0x600001, 500, 500);
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.MakeCurrent(0x600001, 0x300001, 0, (err, tag) => {
            assert.ifError(err);
            const gl = GLX.renderPipeline(tag);
            gl.Lightfv(gl.LIGHT0, gl.POSITION, [5, 5, 10, 0]);
            gl.Enable(gl.CULL_FACE);
            gl.Enable(gl.LIGHTING);
            gl.Enable(gl.LIGHT0);
            gl.Enable(gl.DEPTH_TEST);
            gl.GenLists(3, (err, startIndex) => {
                assert.ifError(err);
                assert.strictEqual(startIndex, 1);
                gl.NewList(startIndex, gl.COMPILE);
                gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, [0.8, 0.1, 0, 1]);
                gl.Begin(gl.QUAD_STRIP);
                gl.Vertex3f(1, 0, 0.5);
                gl.Vertex3f(1, 0, -0.5);
                gl.End();
                gl.EndList();
                const before = rig.backend.calls.length;
                gl.CallList(startIndex);
                gl.Render();
                const replayed = rig.backend.calls.slice(before);
                assert.deepStrictEqual(replayed.map(c => c[0]),
                    ['material', 'begin', 'vertex', 'vertex', 'end']);
                GLX.IsList(tag, startIndex, (err, isList) => {
                    assert.ifError(err);
                    assert.strictEqual(isList, true);
                    done();
                });
            });
        });
    });

    it('GenTextures / IsTexture / DeleteTextures bookkeeping', done => {
        rig.addSurface(0x600001, 16, 16);
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.MakeCurrent(0x600001, 0x300001, 0, (err, tag) => {
            assert.ifError(err);
            GLX.GenTextures(tag, 2, (err, textures) => {
                assert.ifError(err);
                assert.deepStrictEqual(textures, [1, 2]);
                GLX.IsTexture(tag, 1, (err, isTex) => {
                    assert.ifError(err);
                    assert.strictEqual(isTex, true);
                    GLX.DeleteTextures(tag, [1]);
                    GLX.IsTexture(tag, 1, (err, stillTex) => {
                        assert.ifError(err);
                        assert.strictEqual(stillTex, false);
                        const del = rig.backend.calls.find(c => c[0] === 'deleteTextures');
                        assert.deepStrictEqual(del, ['deleteTextures', [1]]);
                        done();
                    });
                });
            });
        });
    });

    it('answers the Get* state queries', done => {
        const MAX_LIGHTS = 0x0D31;
        const MAX_VIEWPORT_DIMS = 0x0D3A;
        GLX.GetIntegerv(0, MAX_LIGHTS, (err, maxLights) => {
            assert.ifError(err);
            assert.strictEqual(maxLights, 8);
            GLX.GetIntegerv(0, MAX_VIEWPORT_DIMS, (err, dims) => {
                assert.ifError(err);
                assert.deepStrictEqual(dims, [4096, 4096]);
                GLX.GetFloatv(0, MAX_LIGHTS, (err, f) => {
                    assert.ifError(err);
                    assert.strictEqual(f, 8);
                    GLX.GetBooleanv(0, 0x0C32 /* DOUBLEBUFFER */, (err, db) => {
                        assert.ifError(err);
                        assert.strictEqual(db, true);
                        GLX.GetIntegerv(0, 0xbeef, (err, unknown) => {
                            assert.ifError(err);
                            assert.deepStrictEqual(unknown, []);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('GetString returns a non-empty GL version (GL-capable context marker)', done => {
        GLX.GetString(0, GLX.VERSION, (err, version) => {
            assert.ifError(err);
            assert.ok(version.length > 0);
            GLX.GetString(0, GLX.VENDOR, (err, vendor) => {
                assert.ifError(err);
                assert.strictEqual(vendor, 'node-x11');
                done();
            });
        });
    });

    it('Finish, GetError and RenderMode reply', done => {
        GLX.Finish(0, err => {
            assert.ifError(err);
            assert.ok(rig.backend.calls.some(c => c[0] === 'finish'));
            GLX.GetError(0, (err, glError) => {
                assert.ifError(err);
                assert.strictEqual(glError, 0);
                GLX.RenderMode(0, 0x1C00, (err, res) => {
                    assert.ifError(err);
                    assert.strictEqual(res.retval, 0x1C00);
                    assert.strictEqual(res.newMode, 0x1C00);
                    assert.deepStrictEqual(res.data, []);
                    done();
                });
            });
        });
    });

    it('runs the pbuffer-interop flow: pbuffer, MakeContextCurrent, ReadPixels', done => {
        GLX.GetFBConfigs(0, (err, configs) => {
            assert.ifError(err);
            const cfg = configs[0];
            GLX.CreatePbuffer(0, cfg.FBCONFIG_ID, 0x700001,
                [GLX.glxAttrib.PBUFFER_WIDTH, 8, GLX.glxAttrib.PBUFFER_HEIGHT, 8]);
            GLX.CreateNewContext(0x300001, cfg.FBCONFIG_ID, 0,
                GLX.glxAttrib.RGBA_TYPE, 0, 0);
            GLX.MakeContextCurrent(0, 0x700001, 0x700001, 0x300001, (err, tag) => {
                assert.ifError(err);
                assert.ok(tag > 0);
                // pbuffer surface sized the backend
                assert.deepStrictEqual(rig.backend.calls[0], ['resize', 8, 8]);
                GLX.PixelStorei(tag, GLX.PACK_ALIGNMENT, 1);
                GLX.ReadPixels(tag, 0, 0, 8, 8, GLX.RGBA, GLX.UNSIGNED_BYTE, 0, 0,
                    (err, rgba) => {
                        assert.ifError(err);
                        assert.strictEqual(rgba.length, 8 * 8 * 4);
                        done();
                    });
            });
        });
    });

    it('honors PACK_ALIGNMENT for RGB ReadPixels row padding', done => {
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.MakeCurrent(0x600001, 0x300001, 0, (err, tag) => {
            assert.ifError(err);
            GLX.PixelStorei(tag, GLX.PACK_ALIGNMENT, 1);
            GLX.ReadPixels(tag, 0, 0, 2, 2, GLX.RGB, GLX.UNSIGNED_BYTE, 0, 0,
                (err, rgb) => {
                    assert.ifError(err);
                    assert.strictEqual(rgb.length, 12); // 2*3 bytes/row, no padding
                    const call = rig.backend.calls.find(c => c[0] === 'readPixels');
                    assert.deepStrictEqual(call[7], { alignment: 1 });
                    done();
                });
        });
    });

    it('QueryContext and GetDrawableAttributes reply with attributes', done => {
        rig.addSurface(0x600001, 320, 200);
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.QueryContext(0x300001, (err, attribs) => {
            assert.ifError(err);
            assert.strictEqual(attribs.VISUAL_ID, VISUAL_ID);
            assert.strictEqual(attribs.RENDER_TYPE, GLX.glxAttrib.RGBA_TYPE);
            GLX.GetDrawableAttributes(0x600001, (err, dattribs) => {
                assert.ifError(err);
                assert.strictEqual(dattribs.WIDTH, 320);
                assert.strictEqual(dattribs.HEIGHT, 200);
                done();
            });
        });
    });

    it('GLX windows resolve to their underlying X drawable surface', done => {
        rig.addSurface(0x600001, 32, 16);
        GLX.CreateWindow(0, 1, 0x600001, 0x800001, []);
        GLX.CreateContext(0x300001, VISUAL_ID, 0, 0, 0);
        GLX.MakeCurrent(0x800001, 0x300001, 0, (err, tag) => {
            assert.ifError(err);
            assert.deepStrictEqual(rig.backend.calls[0], ['resize', 32, 16]);
            GLX.SwapBuffers(tag, 0x800001);
            assert.strictEqual(rig.swaps.length, 1);
            assert.strictEqual(rig.swaps[0].xid, 0x600001);
            done();
        });
    });

    it('handles the SGI/SGIX vendor-private requests', done => {
        rig.addSurface(0x600001, 10, 10);
        GLX.CreateContextWithConfigSGIX(0x300001, 1, 0, GLX.glxAttrib.RGBA_TYPE, 0, 0);
        GLX.MakeCurrentReadSGI(0, 0x600001, 0x600001, 0x300001, (err, tag) => {
            assert.ifError(err);
            assert.ok(tag > 0);
            GLX.GetFBConfigsSGIX(0, (err, configs) => {
                assert.ifError(err);
                assert.strictEqual(configs.length, 1);
                assert.strictEqual(configs[0].VISUAL_ID, VISUAL_ID);
                GLX.CreateGLXPbufferSGIX(0, 1, 0x700002, 24, 12, []);
                GLX.GetDrawableAttributesSGIX(0x700002, (err, attribs) => {
                    assert.ifError(err);
                    assert.strictEqual(attribs.WIDTH, 24);
                    assert.strictEqual(attribs.HEIGHT, 12);
                    done();
                });
            });
        });
    });

    it('rejects unknown vendor-private-with-reply requests', done => {
        GLX.VendorPrivateWithReply(0, 987654, Buffer.alloc(4), err => {
            assert.ok(err);
            assert.strictEqual(err.message, 'GLXUnsupportedPrivateRequest');
            done();
        });
    });

    it('accepts ClientInfo / SetClientInfoARB / SetClientInfo2ARB and WaitGL/WaitX', done => {
        GLX.ClientInfo(1, 4, 'GL_ARB_whatever');
        GLX.SetClientInfoARB(1, 4, [[1, 4]], 'GL_ARB_whatever', 'GLX_ARB_create_context');
        GLX.SetClientInfo2ARB(1, 4, [[1, 4, 1]], '', '');
        GLX.WaitGL(0);
        GLX.WaitX(0);
        // none of these reply and none may error
        GLX.QueryVersion(1, 4, err => {
            assert.ifError(err);
            assert.deepStrictEqual(rig.errors, []);
            done();
        });
    });

    it('survives a malformed request body without crashing', done => {
        // truncated body for a request that reads offsets beyond it
        rig.ext.handleRequest({
            sendReply() {},
            sendError() {}
        }, 5, Buffer.alloc(2));
        assert.ok(rig.ext.lastInternalError);
        // still fully operational afterwards
        GLX.QueryVersion(1, 4, (err, version) => {
            assert.ifError(err);
            assert.deepStrictEqual(version, [1, 4]);
            done();
        });
    });
});
