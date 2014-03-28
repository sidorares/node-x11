var x11 = require('../../lib');
var PointerMotion = x11.eventMask.PointerMotion;

function padWidth(buf, width) {
  var height = buf.length / width;
}

var xclient = x11.createClient({ debug: true }, function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    display.client.require('render', function(Render) {
        var wid = X.AllocID();
        var white = display.screen[0].white_pixel;
        varblack = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion });
        X.MapWindow(wid);

        var glyphSet = X.AllocID();
        Render.CreateGlyphSet(glyphSet, Render.a8);

        var pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);

        var pictGrad = X.AllocID();
        Render.RadialGradient(pictGrad, [260,260], [260,260], 0, 260,
            [
                [0,   [0,0,0,0x0fff ] ],
                //[0.3,   [0,0,0,0x0fff ] ],
                //[0.997,   [0xffff, 0xf, 0, 0x1] ],
                //[1,   [0xffff, 0xffff, 0, 0x0] ],
                [1,   [0,0,0,0x0fff ] ],
            ]);


        var glyphs = require('./ob-font-50pt100dpi.json');
        glyphs.forEach(function(g) {
          if (!g.image || g.image.length == 0)
             g.image = new Buffer(0);
          else
             g.image = new Buffer(g.image, 'base64');
          //g.image = padWidth(g.image, w.width);
        });
        Render.AddGlyphs(glyphSet, [glyphs[10],glyphs[24]]);
        //Render.AddGlyphs(glyphSet, glyphs);

        function draw(x, y) {
          // op, src, dst, maskFormat, gsid, srcX, srcY, dstX, dstY, glyphs
          Render.CompositeGlyphs8(3, pictGrad, pict, 0, glyphSet, 100, 100, ['----', '=']);
          //Render.Composite(3, pictGrad, 0, pict, 0, 0, 0, 0, x-260, y-260, 520, 520);
        }

        X.on('event', function(ev) {
           draw(ev.x, ev.y);
        });
    });
});
