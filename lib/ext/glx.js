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
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(clientMaj >>> 0, 4);
            b.writeUInt32LE(clientMin >>> 0, 8);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(19, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(name >>> 0, 8);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(visual >>> 0, 8);
            b.writeUInt32LE(pixmap >>> 0, 12);
            b.writeUInt32LE(glxpixmap >>> 0, 16);
            X.pack_stream.put(b);

            console.log('CreateGlxPix', X.seq_num);
            console.log(ext.majorOpcode, 13, 5, screen, visual, pixmap, glxpixmap);
            console.trace();


            X.pack_stream.flush();
        }

        ext.QueryExtensionsString = (screen, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(18, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(screen >>> 0, 4);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(14, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(screen >>> 0, 4);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(21, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(screen >>> 0, 4);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(24);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(6, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(visual >>> 0, 8);
            b.writeUInt32LE(screen >>> 0, 12);
            b.writeUInt32LE(shareListCtx >>> 0, 16);
            b.writeUInt8(isDirect, 20);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.SwapBuffers = (ctx, drawable) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(11, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.NewList = (ctx, list, mode) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(101, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(list >>> 0, 8);
            b.writeUInt32LE(mode >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.EndList = ctx => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(102, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.GenLists = (ctx, count, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(104, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(count >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                callback
            ];
            X.pack_stream.flush();
        }

        ext.GenTextures = (ctx, count, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(145, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(count >>> 0, 8);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(146, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(texture >>> 0, 8);
            X.pack_stream.put(b);
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
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(ctx >>> 0, 8);
            b.writeUInt32LE(oldctx >>> 0, 12);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Finish = (ctx, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(108, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            X.pack_stream.put(b);
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
            const hdr = Buffer.alloc(8);
            hdr.writeUInt8(ext.majorOpcode, 0);
            hdr.writeUInt8(1, 1);
            hdr.writeUInt16LE(length, 2);
            hdr.writeUInt32LE(ctx >>> 0, 4);
            X.pack_stream.put(hdr);
            if (Buffer.isBuffer(data))
                X.pack_stream.put(data);
            else if (Array.isArray(data))
                for (let i=0; i < data.length; ++i)
                    X.pack_stream.put(data[i]);
            else
                throw new Error('invalid data, expected buffer or buffers array', data);
            X.pack_stream.flush();
        }

        ext.VendorPrivate = (ctx, code, data) => {
            X.seq_num++;
            const hdr = Buffer.alloc(12);
            hdr.writeUInt8(ext.majorOpcode, 0);
            hdr.writeUInt8(16, 1);
            hdr.writeUInt16LE(3 + data.length / 4, 2);
            hdr.writeUInt32LE(code >>> 0, 4);
            hdr.writeUInt32LE(ctx >>> 0, 8);
            X.pack_stream.put(hdr);
            X.pack_stream.put(data);
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
          const hdr = Buffer.alloc(16);
          hdr.writeUInt8(ext.majorOpcode, 0);
          hdr.writeUInt8(2, 1);
          hdr.writeUInt16LE(length, 2);
          hdr.writeUInt32LE(ctx >>> 0, 4);
          hdr.writeUInt16LE(requestNum, 8);
          hdr.writeUInt16LE(requestTotal, 10);
          hdr.writeUInt32LE(data.length >>> 0, 12);
          X.pack_stream.put(hdr);
          X.pack_stream.put(data);
          const pad = Buffer.alloc(padLength);
          pad.fill(0);
          X.pack_stream.put(pad);
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
