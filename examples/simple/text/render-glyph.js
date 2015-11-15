var x11 = require('../../../lib');
var fs = require('fs');
var PointerMotion = x11.eventMask.PointerMotion;
var Exposure      = x11.eventMask.Exposure;


        var ft2 = require('freetype2_render');
        var fontface= ft2.parse(fs.readFileSync(process.argv[2]))
        //console.log(fontface.hasKerning(), process.argv[2], '\n', fontface);
        //process.exit(0);
        /*
        fontface.available_characters.forEach(function(left) {
          fontface.available_characters.forEach(function(right) {
            var kern = fontface.kerning(left, right, 50, 0, 96, 0);
            if (kern.x != 0 || kern.y != 0)
              console.log(left, right, kern);
          });
        });
        */
        //console.log(fontface.kerning('A'.charCodeAt(0), 'V'.charCodeAt(0), 50, 0, 96, 0))


function padWidth(buf, width) {
  var height = buf.length / width;
  if (width %4 === 0)
    return buf;
  else {
    var stride = (width+3)&~3;
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
    display.client.require('render', function(err, Render) {
        var wid = X.AllocID();
        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: Exposure|PointerMotion });
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
                [0,     [0x0000, 0x0, 0, 0xffff ] ],
                [0.3,   [0xffff, 0x0, 0, 0xffff ] ],
                [0.997, [0xffff, 0xf, 0, 0x1] ],
                [1,     [0x0000, 0x0, 0, 0xffff ] ],
            ]
        );

        var pictLinearGrad = X.AllocID();
        Render.LinearGradient(pictLinearGrad, [0,0], [1000,100],
                [
                  [0,   [0,0,0,0xffff ] ],
                 // [0.1, [0xfff, 0, 0xffff, 0x1000] ] ,
                 // [0.25, [0xffff, 0, 0xfff, 0x3000] ] ,
                 // [0.5, [0xffff, 0, 0xffff, 0x4000] ] ,
                  [1,   [0xffff, 0xffff, 0, 0xffff] ]
                ]);



       var size = parseInt(process.argv[3]*64);

       console.log(fontface.available_characters.length);
        var glyphs = fontface.available_characters.map(function(ch) { return fontface.render(ch, size, 0, 96, 0); });
        var glyphFromCode = [];
        glyphs.forEach(function(g) {
          if (!g.image || (g.image.length == 0)) {
            g.image = new Buffer(64);
            g.image.fill(0);
            g.width = 8;
            g.height = 8;
            g.x = 0;
            g.y = 0;
          }
          else {
            g.origWidth = g.width;
            g.image = padWidth(g.image, g.width);
            g.width = g.image.length / g.height;
          }
          glyphFromCode[g.id] = g;
        });

        Render.AddGlyphs(glyphSet, glyphs);
        var text = process.argv[4];
        var elems = [];
        var pos = 0;
        var start = 0;
        var offX = 0;
        while (pos + 1 < text.length) {
          var kern = fontface.kerning(text.charCodeAt(pos), text.charCodeAt(pos+1), size, 0, 96, 0);
          console.log(kern, text[pos], text[pos+1]);
          if (kern.x) {
            elems.push([offX, 0, text.slice(start, pos+1)]);
            start = pos+1;
            offX = Math.round(size*kern.x/(26.6*64*64));
          }
          pos++;
        }
        elems.push([offX, 0, text.slice(start, text.length)]);
        elems[0][1] = 60;
        console.log(elems);

        function draw(x, y) {
          if (!y)
            y = 0;
          if (!x)
            x = 0;
          // TODO: example with multiple glyphsets in one CompositeGlyphs call
          Render.FillRectangles(1, pict, [0xffff, 0xffff, 0xffff, 0xffff], [0, 0, 3000, 3000]);
          //Render.Composite(3, pictLinearGrad, 0, pict, 0, 0, 0, 0, 0, 0, 2500, 2500);
          // op, src, dst, maskFormat, gsid, srcX, srcY, dstX, dstY, glyphs
          //Render.CompositeGlyphs8(3, pictSolidPix, pict, 0, glyphSet, 0, 0, [[10, 60, process.argv[4]]]);
          var yoff = 2*parseInt(process.argv[3]);
          Render.CompositeGlyphs32(3, pictSolidPix, pict, 0, glyphSet, 260-x, yoff+260-y, elems);
          Render.CompositeGlyphs32(3, pictSolidPix, pict, 0, glyphSet, 260-x, yoff+260-y, [[0, 140, text]]);
        }

        X.on('event', function(ev) {
           draw(ev.x, ev.y);
        });
    });
});
