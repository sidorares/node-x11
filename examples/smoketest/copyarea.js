const x11 = require('../../lib');
const Window = require('./wndwrap');

x11.createClient((err, display) => {

    const pts = [];
    new Window(display.client, 0, 0, 700, 500)
        .handle({

            map(ev) {
                this.pixmap = this.createPixmap(700, 500);
            },

            mousemove(ev) {
                if (this.pressed)
                {
                    const lastpoly = pts[pts.length - 1];
                    lastpoly.push(ev.x); 
                    lastpoly.push(ev.y);
                    if (lastpoly.length > 3)
                        this.gc.polyLine(lastpoly.slice(-4));
                }
            },

            mousedown(ev) {
                if (ev.keycode == 1) // left button
                {
                    this.pressed = true;
                    pts.push([]);
		}            
            },

            mouseup(ev) {
                if (ev.keycode == 1) // left button
                   this.pressed = false;
            },

            expose(ev) {
                for (let i=0; i < pts.length ; ++i) {
                    this.pixmap.gc.polyLine(pts[i]);
                }
                // todo: resize
                this.gc.copy(this.pixmap, 0, 0, 0, 0, 700, 500);
            }

        })
       .map()
       .title = 'Hello, world!';
}).on('error', err => {
    console.error(err);
});
