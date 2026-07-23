const x11 = require('../../lib');
const Window = require('./wndwrap');

x11.createClient((err, display) => {

    const pts = [];
    new Window(display.client, 0, 0, 600, 400, display.screen[0].white_pixel)
        .handle({

            create(ev) {
                console.log(eve);
            },

            map(ev) {
                console.log(ev);

                for (let i=0; i < 29; ++i)
                    for (let j=0; j < 19; ++j)
                    {
                        new Window( this, 10+i*20, 10+j*20, 17, 17, display.screen[0].black_pixel)
                           .handle({
                               mousemove() {
                                   const self = this;
                                   self.unmap();
                                   setTimeout(() => {
                                       self.map();
                                   }, 500);
                               }
                            
                           })
                           .map();
                    }
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
                //for (var i=0; i < pts.length ; ++i) {
                //    this.gc.polyLine(pts[i]);
                //}
            }

        })
       .map()
       .title = 'Hello, world!';
});
