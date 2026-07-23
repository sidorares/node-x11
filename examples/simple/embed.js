const spawn = require('child_process').spawn;
const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const wid = X.AllocID();
    X.CreateWindow(wid, display.screen[0].root, 100, 100, 900, 700, 0, 0, 0, 0, {backgroundPixel: display.screen[0].black_pixel});
    X.MapWindow(wid);
    const wid1 = X.AllocID();
    X.CreateWindow(wid1, wid, 10, 10, 380, 680, 0, 0, 0, 0, {backgroundPixel: display.screen[0].white_pixel});
    X.MapWindow(wid1);
    const surf = spawn('ssh', ['-X', '-p', '2222', 'laplace@127.0.0.1', `surf -x -e ${wid1} http://192.168.43.149:4000`]);
    surf.winbuf = '';
    surf.stdout.on('data',
       function handleWid(buf)
       {
          surf.winbuf += buf.toString();
          const nl = surf.winbuf.indexOf('\n');
          if (nl != -1) {
             const swid = parseInt(surf.winbuf.substring(0, nl));
             X.MoveResizeWindow(swid, 10, 10, 380, 680);
             X.MapWindow(swid);
             surf.stdout.removeListener('data', handleWid);
             //surf.stdout.pipe(process.stdout);
             //surf.stderr.pipe(process.stdout);
          }
       }
    );
    const wid2 = X.AllocID();
    X.CreateWindow(wid2, wid, 510, 10, 380, 680, 0, 0, 0, 0, {backgroundPixel: display.screen[0].white_pixel});
    X.MapWindow(wid2);
    const xterm = spawn('xterm', ['-into', wid2]);
    //console.log(wid, wid1);
    // X.on('error', function(err) { console.log(err) });
    // X.on('event', console.log);
});

