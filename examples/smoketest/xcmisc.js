var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('xc-misc', function(err, Misc) {
        var xid = X.AllocID();
        console.log("first ID from connection: " + xid);
        debugger;
        Misc.GetXIDRange(function(err, range) {
           console.log("ID range from GetIDRange: [start:" + range.startId + ", count: " + range.count + "]");
        });
        Misc.GetXIDList(100, function(err, list) {
           console.log("ID list from GetIDList(100) : " + list);
        });
    });
    X.on('error', function(err) { console.log("Error", err); });

});
