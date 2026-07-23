const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('xc-misc', (err, Misc) => {
        const xid = X.AllocID();
        console.log(`first ID from connection: ${xid}`);
        debugger;
        Misc.GetXIDRange((err, range) => {
           console.log(`ID range from GetIDRange: [start:${range.startId}, count: ${range.count}]`);
        });
        Misc.GetXIDList(100, (err, list) => {
           console.log(`ID list from GetIDList(100) : ${list}`);
        });
    });
    X.on('error', err => { console.log("Error", err); });

});
