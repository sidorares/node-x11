var x11 = require('../lib');
var wid = process.argv[2];
console.log(wid);

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;

    var id = wid ? wid : root;
    var gc = X.AllocID();
    X.CreateGC(gc, id);
    var width = 0;
    var hwight = 0;
    X.GetGeometry(id, function(err, clientGeom) {
        width = clientGeom.width;
        height = clientGeom.height;


            var dispwin = X.AllocID();
            X.CreateWindow(dispwin, root, 0, 0, width, height, 0, 0, 0, 0, { eventMask: x11.eventMask.Exposure });
            X.MapWindow(dispwin);
            //X.CopyArea(idScreenshot, dispwin, gc, 0, 0, 0, 0, width, height);


        //var idScreenshot = X.AllocID();
        //X.CreatePixmap(idScreenshot, root, 24, clientGeom.width, clientGeom.height);
        // ask recursively each window to copy itself to pixmap

        function drawWithKids(list, cb)
        {
            if (list.length == 0)
                return cb();
            var p = list.pop();
            var win = p.win;
            if (win == dispwin)
                return drawWithKids(list, cb);

            X.GetWindowAttributes(win, function(err, res) {
                if (res[8] == 0)
                    return drawWithKids(list, cb);
                X.GetGeometry(win, function(err, geom) {
                    // (srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height)
                    if (win != root)
                        X.CopyArea(win, dispwin, gc, 0, 0, p.x + geom.xPos, p.y + geom.yPos, geom.width, geom.height);
                    //X.CopyArea(win, idScreenshot, gc, 0, 0, p.x + geom.xPos, p.y + geom.yPos, geom.width, geom.height);
                    X.QueryTree(win, function(tree) {
                        tree.children.reverse().forEach(function(subwin) {
                            list.push({win: subwin, x: p.x + geom.xPos, y: p.y + geom.yPos});
                        });
                        drawWithKids(list, cb);
                    });
                });
            });
        };

        /*
        //setInterval(function() {
        var list = [{win: id, x: 0, y: 0}];
        drawWithKids(list, function() {
            // (format, drawable, x, y, width, height, planeMask)
            //X.GetImage(2, dispwin, 0, 0, width, height, 0xffffffff, function(data) {
            //X.GetImage(2, root, 0, 0, width, height, 0xffffffff, function(data) {
            //    console.log(data);
            //});
            console.log('DONE! ready');
            X.terminate();
            //var dispwin = X.AllocID();
            //X.CreateWindow(dispwin, root, 0, 0, width, height, 1, 1, 0, { eventMask: x11.eventMask.Exposure });
            //X.MapWindow(dispwin);
            //X.CopyArea(idScreenshot, dispwin, gc, 0, 0, 0, 0, width, height);

        });
        */
        X.GetImage(2, id, 0, 0, width, height, 0xffffffff, function(err, image) {
            if (err) {
              console.log(err);
              process.exit(1);
            }
            console.log(image);
            // format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data
            X.PutImage(2, dispwin, gc, width, height, 0, 0, 0, 24, image.data);
        });
        //}, 1000);
    });
}).on('error', function(err) {
    console.log(err);
});
