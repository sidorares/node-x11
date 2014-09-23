/*
  second extension to try
  links to get started:

  http://cgit.freedesktop.org/xcb/proto/tree/src/glx.xml?id=HEAD
  http://cgit.freedesktop.org/mesa/mesa/tree/src/glx
  http://cgit.freedesktop.org/mesa/mesa/tree/src/glx/indirect.c

  http://www.opengl.org/wiki/Tutorial:_OpenGL_3.0_Context_Creation_(GLX)

  https://github.com/xderoche/J11/blob/master/src/gnu/x11/extension/glx/GL.java


*/
var x11 = require('..');
// TODO: move to templates
exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('GLX', function(err, ext) {
        var constants = require('./glxconstants');
        for (var i in constants)
            ext[i] = constants[i];

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.QueryVersion = function(clientMaj, clientMin, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 7, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LL');
                    return res;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.QueryServerString = function(screen, name, callback) {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 19, 3, screen, name]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var len = buf.unpack('xxxxL')[0];
                    return buf.toString().substring(24, 24+len*4);
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.CreateGLXPixmap = function(screen, visual, pixmap, glxpixmap) {
            X.seq_num++;
            X.pack_stream.pack('CCSLLLL', [ext.majorOpcode, 13, 5, screen, visual, pixmap, glxpixmap]);

            console.log('CreateGlxPix', X.seq_num);
            console.log(ext.majorOpcode, 13, 5, screen, visual, pixmap, glxpixmap);
            console.trace();


            X.pack_stream.flush();
        }

        ext.QueryExtensionsString = function(screen, callback) {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 18, 2, screen]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var len = buf.unpack('xxxxL')[0];
                    return buf.toString().substring(24, 24+len*4);
                },
                callback
            ];
            X.pack_stream.flush();
        }

        // see __glXInitializeVisualConfigFromTags in mesa/src/glx/glxext.c
        //
        ext.GetVisualConfigs = function(screen, callback) {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 14, 2, screen]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LL');
                    var numConfigs = res[0];
                    var numProps = res[1];
                    var configs = new Array(numConfigs);
                    var i,j;
                    for (i=0; i < numConfigs; ++i) {
                        var props = {}; //new Array(numProps);
                        var names = 'visualID visualType rgbMode redBits greenBits blueBits alphaBits accumRedBits accumGreen accumBlueBits accumAlphaBits doubleBufferMode stereoMode rgbBits depthBits stencilBits numAuxBuffers level'.split(' ');
                        for (var j=0; j < 18 && j < numProps; ++j) {
                            props[names[j]] = buf.unpack('L', 24+(i*numProps +j)*4)[0];
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

        ext.GetFBConfigs = function(screen, callback) {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 21, 2, screen]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LL');
                    var numConfigs = res[0];
                    var numProps = res[1];
                    var configs = new Array(numConfigs);
                    var i,j;
                    for (i=0; i < numConfigs; ++i) {
                        var props = new Array(numProps);
                        for (var j=0; j < numProps; ++j) {
                            props[j] = buf.unpack('LL', 24+(i*numProps +j)*8);
                        }
                        configs[i] = props;
                    }
                    return configs;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.CreateContext = function(ctx, visual, screen, shareListCtx, isDirect)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLLLCxxx', [ext.majorOpcode, 3, 6, ctx, visual, screen, shareListCtx, isDirect]);
            X.pack_stream.flush();
        }

        ext.SwapBuffers = function(ctx, drawable)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 11, 3, ctx, drawable]);
            X.pack_stream.flush();
        }

        ext.NewList = function(ctx, list, mode)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 101, 4, ctx, list, mode]);
            X.pack_stream.flush();
        }

        ext.EndList = function(ctx)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 102, 2, ctx]);
            X.pack_stream.flush();
        }

        ext.GenLists = function(ctx, count, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 104, 3, ctx, count]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    return buf.unpack('L')[0];
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.GenTextures = function(ctx, count, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 145, 3, ctx, count]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var format = Buffer(count);
                    format.fill('L');
                    return buf.unpack('xxxxxxxxxxxxxxxxxxxxxxxx' + format.toString());
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.IsTexture = function(ctx, texture, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 146, 3, ctx, texture]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    return buf.unpack('CCCCCCCCCCCCCCCCCCCCCCCCCC');
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.MakeCurrent = function(drawable, ctx, oldctx, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 5, 4, drawable, ctx, oldctx]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    return buf.unpack('L')[0];
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Finish = function(ctx, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 108, 2, ctx]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    return;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Render = function(ctx, data) {
            X.seq_num++;
            var length = 0;
            if (Buffer.isBuffer(data))
                length = 2+data.length/4;
            else if (Array.isArray(data)) {
                length = 2;
                for (var i=0; i < data.length; ++i)
                    length += data[i].length/4;
            }
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 1, length, ctx]);
            if (Buffer.isBuffer(data))
                X.pack_stream.write_queue.push(data);
            else if (Array.isArray(data))
                for (var i=0; i < data.length; ++i)
                    X.pack_stream.write_queue.push(data[i]);
            else
                throw new Error('invalid data, expected buffer or buffers array', data);
            X.pack_stream.flush();
        }

        ext.VendorPrivate = function(ctx, code, data) {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 16, 3+data.length/4, code, ctx]);
            X.pack_stream.write_queue.push(data);
            X.pack_stream.flush();
        }

        // 1330 - X_GLXvop_BindTexImageEXT
        // 1331 - X_GLXvop_ReleaseTexImageEXT
        ext.BindTexImage = function(ctx, drawable, buffer, attribs) {
           if (!attribs)
             attribs = [];
           var data = new Buffer(12 + attribs.length*4);
           data.writeUInt32LE(drawable, 0);
           data.writeUInt32LE(buffer, 4);
           data.writeUInt32LE(attribs.length, 8);
           for (var i=0; i < attribs.length; ++i)
             data.writeUint32LE(attribs.length, 12+i*4);
           ext.VendorPrivate(ctx, 1330, data);
        }

        ext.ReleaseTexImage = function(ctx, drawable, buffer) {
           var data = new Buffer(8);
           data.writeUint32LE(drawable, 0);
           data.writeUint32LE(buffer, 4);
           ext.VendorPrivate(ctx, 1331, data);
        }

        // VendorPrivateWithReply - opcode 17

        ext.RenderLarge = function(ctx, requestNum, requestTotal, data) {
          X.seq_num++;

          //var data = Buffer.concat(data);
          var padLength = 4 - data.length % 4;
          if (padLength == 4)
            padLength = 0;
          var length = 4 + (data.length+padLength) / 4;
          X.pack_stream.pack('CCSLSSL', [ext.majorOpcode, 2, length, ctx, requestNum, requestTotal, data.length]);

          X.pack_stream.write_queue.push(data);
          var pad = new Buffer(padLength);
          pad.fill(0);
          X.pack_stream.write_queue.push(pad);
          X.pack_stream.flush();
        }

        ext.renderPipeline = function(ctx) {
            return require('./glxrender')(this, ctx);
        }

	var errors = [
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

	errors.forEach(function(message, code) {
  	  X.errorParsers[ext.firstError + code] = function(err) {
	    err.message = "GLX: Bad " + message;
	  };
	});

        callback(null, ext);
    });
}

