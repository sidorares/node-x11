let angle = 0;
const x11 = require('../../lib').createClient((err, display) => {
    setInterval(() => {
        const x = 500 + 100*Math.cos(angle);
        const y = 500 + 100*Math.sin(angle);
        display.client.WarpPointer(0, display.screen[0].root, 0, 0, 0, 0, parseInt(x), parseInt(y));
        angle += 0.05;
    }, 100);
});
