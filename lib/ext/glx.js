/*
  second extension to try
  links to get started:

  http://cgit.freedesktop.org/xcb/proto/tree/src/glx.xml?id=HEAD
  http://cgit.freedesktop.org/mesa/mesa/tree/src/glx
  http://cgit.freedesktop.org/mesa/mesa/tree/src/glx/indirect.c

  http://www.opengl.org/wiki/Tutorial:_OpenGL_3.0_Context_Creation_(GLX)

  https://github.com/xderoche/J11/blob/master/src/gnu/x11/extension/glx/GL.java


*/
const x11 = require('..');
// TODO: move to templates
exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('GLX', (err, ext) => {
        const constants = require('./glxconstants');
        for (const i in constants)
            ext[i] = constants[i];

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.QueryVersion = (clientMaj, clientMin, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 7, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.QueryServerString = (screen, name, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 19, 3, screen, name]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const len = buf.readUInt32LE(4);
                    return buf.toString('latin1', 24, 24 + len * 4);
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.CreateGLXPixmap = (screen, visual, pixmap, glxpixmap) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLLLL', [ext.majorOpcode, 13, 5, screen, visual, pixmap, glxpixmap]);

            console.log('CreateGlxPix', X.seq_num);
            console.log(ext.majorOpcode, 13, 5, screen, visual, pixmap, glxpixmap);
            console.trace();


            X.pack_stream.flush();
        }

        ext.QueryExtensionsString = (screen, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 18, 2, screen]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const len = buf.readUInt32LE(4);
                    return buf.toString('latin1', 24, 24 + len * 4);
                },
                callback
            ];
            X.pack_stream.flush();
        }

        // see __glXInitializeVisualConfigFromTags in mesa/src/glx/glxext.c
        //
        ext.GetVisualConfigs = (screen, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 14, 2, screen]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numConfigs = buf.readUInt32LE(0);
                    const numProps = buf.readUInt32LE(4);
                    const configs = new Array(numConfigs);
                    let i;
                    for (i=0; i < numConfigs; ++i) {
                        const props = {}; //new Array(numProps);
                        const names = 'visualID visualType rgbMode redBits greenBits blueBits alphaBits accumRedBits accumGreen accumBlueBits accumAlphaBits doubleBufferMode stereoMode rgbBits depthBits stencilBits numAuxBuffers level'.split(' ');
                        for (let j=0; j < 18 && j < numProps; ++j) {
                            props[names[j]] = buf.readUInt32LE(24 + (i * numProps + j) * 4);
                        }
                        // read tag + property
                        configs[i] = props;
                    }

                    return configs;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.GetFBConfigs = (screen, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 21, 2, screen]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numConfigs = buf.readUInt32LE(0);
                    const numProps = buf.readUInt32LE(4);
                    const configs = new Array(numConfigs);
                    let i;
                    for (i=0; i < numConfigs; ++i) {
                        const props = new Array(numProps);
                        for (let j=0; j < numProps; ++j) {
                            const off = 24 + (i * numProps + j) * 8;
                            props[j] = [buf.readUInt32LE(off), buf.readUInt32LE(off + 4)];
                        }
                        configs[i] = props;
                    }
                    return configs;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.CreateContext = (ctx, visual, screen, shareListCtx, isDirect) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLLLLCxxx', [ext.majorOpcode, 3, 6, ctx, visual, screen, shareListCtx, isDirect]);
            X.pack_stream.flush();
        }

        ext.SwapBuffers = (ctx, drawable) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 11, 3, ctx, drawable]);
            X.pack_stream.flush();
        }

        ext.NewList = (ctx, list, mode) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 101, 4, ctx, list, mode]);
            X.pack_stream.flush();
        }

        ext.EndList = ctx => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 102, 2, ctx]);
            X.pack_stream.flush();
        }

        ext.GenLists = (ctx, count, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 104, 3, ctx, count]);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                callback
            ];
            X.pack_stream.flush();
        }

        ext.GenTextures = (ctx, count, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 145, 3, ctx, count]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = [];
                    for (let i = 0; i < count; ++i)
                        res.push(buf.readUInt32LE(24 + i * 4));
                    return res;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.IsTexture = (ctx, texture, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 146, 3, ctx, texture]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = [];
                    for (let i = 0; i < 26; ++i)
                        res.push(buf.readUInt8(i));
                    return res;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.MakeCurrent = (drawable, ctx, oldctx, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 5, 4, drawable, ctx, oldctx]);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Finish = (ctx, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 108, 2, ctx]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Render = (ctx, data) => {
            X.seq_num++;
            let length = 0;
            if (Buffer.isBuffer(data))
                length = 2+data.length/4;
            else if (Array.isArray(data)) {
                length = 2;
                for (let i=0; i < data.length; ++i)
                    length += data[i].length/4;
            }
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 1, length, ctx]);
            if (Buffer.isBuffer(data))
                X.pack_stream.write_queue.push(data);
            else if (Array.isArray(data))
                for (let i=0; i < data.length; ++i)
                    X.pack_stream.write_queue.push(data[i]);
            else
                throw new Error('invalid data, expected buffer or buffers array', data);
            X.pack_stream.flush();
        }

        ext.VendorPrivate = (ctx, code, data) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 16, 3+data.length/4, code, ctx]);
            X.pack_stream.write_queue.push(data);
            X.pack_stream.flush();
        }

        // 1330 - X_GLXvop_BindTexImageEXT
        // 1331 - X_GLXvop_ReleaseTexImageEXT
        ext.BindTexImage = (ctx, drawable, buffer, attribs) => {
           if (!attribs)
             attribs = [];
           const data = Buffer.alloc(12 + attribs.length*4);
           data.writeUInt32LE(drawable, 0);
           data.writeUInt32LE(buffer, 4);
           data.writeUInt32LE(attribs.length, 8);
           for (let i=0; i < attribs.length; ++i)
             data.writeUint32LE(attribs.length, 12+i*4);
           ext.VendorPrivate(ctx, 1330, data);
        }

        ext.ReleaseTexImage = (ctx, drawable, buffer) => {
           const data = Buffer.alloc(8);
           data.writeUint32LE(drawable, 0);
           data.writeUint32LE(buffer, 4);
           ext.VendorPrivate(ctx, 1331, data);
        }

        // VendorPrivateWithReply - opcode 17

        ext.RenderLarge = (ctx, requestNum, requestTotal, data) => {
          X.seq_num++;

          //var data = Buffer.concat(data);
          let padLength = 4 - data.length % 4;
          if (padLength == 4)
            padLength = 0;
          const length = 4 + (data.length+padLength) / 4;
          X.pack_stream.pack('CCSLSSL', [ext.majorOpcode, 2, length, ctx, requestNum, requestTotal, data.length]);

          X.pack_stream.write_queue.push(data);
          const pad = Buffer.alloc(padLength);
          pad.fill(0);
          X.pack_stream.write_queue.push(pad);
          X.pack_stream.flush();
        }

        ext.renderPipeline = function(ctx) {
            return require('./glxrender')(this, ctx);
        }

	const errors = [
	  "context",
	  "contect state",
	  "drawable",
	  "pixmap",
	  "context tag",
	  "current window",
	  "Render request",
	  "RenderLarge request",
	  "(unsupported) VendorPrivate request",
	  "FB config",
	  "pbuffer",
	  "current drawable",
	  "window"
        ];

	errors.forEach((message, code) => {
  	  X.errorParsers[ext.firstError + code] = err => {
	    err.message = `GLX: Bad ${message}`;
	  };
	});

        callback(null, ext);
    });
}

