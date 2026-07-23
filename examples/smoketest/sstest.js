const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    //X.ForceScreenSaver(0);
    X.SetScreenSaver(20, 10, 2, 2);


    X.require('screen-saver', (err, SS) => {
        SS.SelectInput(root, SS.eventMask.Notify|SS.eventMask.Cycle);
        //console.log(SS);
        //setTimeout(function() {
        //    X.ForceScreenSaver(1);
        //}, 5000);
        setInterval(() => {
        SS.QueryInfo(root, (err, info) => {
            console.log(info.until);
            //SS.SelectInput(root, SS.eventMask.Notify|SS.eventMask.Cycle);
        });
        }, 1000);
        X.on('event', ev => {
            console.log(ev);
        });
    });
    X.on('error', err => { console.log(err); });

});
