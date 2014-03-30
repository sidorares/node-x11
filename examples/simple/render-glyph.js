var x11 = require('../../lib');
var PointerMotion = x11.eventMask.PointerMotion;

function padWidth(buf, width) {
  var height = buf.length / width;
  if (width %4 === 0)
    return buf;
  else {
    var stride = (width+3)&~3;
    console.log('Resize: (' + width + 'x' + height + ') to ' + stride);
    var res = new Buffer(height*stride);
    res.fill(0);
    for (var y=0; y < height; ++y) {
      // memcpy(tmpbitmap+y*stride, bitmap->buffer+y*ginfo.width, ginfo.width);
      buf.copy(res, y*stride, y*width, y*width + width);
    }
    return res;
  } 
}

var xclient = x11.createClient({ debug: true }, function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    display.client.require('render', function(Render) {
        var wid = X.AllocID();
        var white = display.screen[0].white_pixel;
        varblack = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: x11.eventMask.Exposure });
        X.MapWindow(wid);

        var glyphSet = X.AllocID();
        Render.CreateGlyphSet(glyphSet, Render.a8);

        var pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);

        var pix = X.AllocID();
        X.CreatePixmap(pix, root, 32, 1, 1);
        var pictSolidPix = X.AllocID();
        Render.CreatePicture(pictSolidPix, pix, Render.rgba32, {repeat: 1});
        Render.FillRectangles(1, pictSolidPix, [0x0, 0x0, 0x0, 0xffff], [0, 0, 100, 100]);
        //X.FreePixmap(pix);

        var pictGrad = X.AllocID();
        Render.RadialGradient(pictGrad, [260,260], [260,260], 0, 260,
            [
                [0,   [0,0,0,0x0fff ] ],
                //[0.3,   [0,0,0,0x0fff ] ],
                //[0.997,   [0xffff, 0xf, 0, 0x1] ],
                //[1,   [0xffff, 0xffff, 0, 0x0] ],
                [1,   [0,0,0,0x0fff ] ],
            ]);


     
        //Render.AddGlyphs(glyphSet, glyphs.slice(0, 128));
 var glyphs = require('./ob-font-50pt100dpi.json');
 debugger;

        glyphs.forEach(function(g) {
          if (!g.image || (g.image.length == 0))
             g.image = new Buffer(0);
          else {
             g.image = new Buffer(g.image, 'base64');
             g.image = padWidth(g.image, g.width);
	     g.width = g.image.length / g.height;
	     if (isNaN(g.width))
		debugger
	  }
        });
        //Render.AddGlyphs(glyphSet, [glyphs[10],glyphs[24]]);
        Render.AddGlyphs(glyphSet, glyphs.slice(0, 128));
        //Render.AddGlyphs(glyphSet, glyphs);
	//for(var i=0; i < 120; ++i)
	//  Render.AddGlyphs(glyphSet, [glyphs[i]]);

        function draw(x, y) {
          Render.FillRectangles(1, pict, [0xffff, 0xffff, 0xffff, 0xffff], [0, 0, 1000, 1000]);
          // op, src, dst, maskFormat, gsid, srcX, srcY, dstX, dstY, glyphs
          
	  Render.CompositeGlyphs8(3, pictSolidPix, pict, 0, glyphSet, 0, 0, [[10, 60,'12345678 Hello! '], [100, 100, 'World *&@#$%']]);
          
	  //Render.CompositeGlyphs8(3, pictGrad, pict, 0, glyphSet, 0, 0, [[10, 60,'12345678 Hello! ', 'World']]);
          //Render.CompositeGlyphs8(3, pictSolidPix, pict, 0, glyphSet, 100, 100, [[50, 50,'----'], [10, 10, '=-=-']]);
          //Render.Composite(3, pictGrad, 0, pict, 0, 0, 0, 0, x-260, y-260, 520, 520);
        }

        X.on('event', function(ev) {
           draw(ev.x, ev.y);
        });
    });
});
