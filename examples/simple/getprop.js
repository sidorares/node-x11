// ChangeProperty/GetProperty / PropertyChange event example

var x11 = require('../../lib');
var PropertyChange = x11.eventMask.PropertyChange;

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { eventMask: PropertyChange });
    X.MapWindow(wid);

    // mode: 0 replace, 1 prepend, 2 append
    // mode, wid, name, type, format, data
    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'Hello, NodeJS');
    var interval = setInterval(function() {
           X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'Hello, NodeJS ' + new Date());
    }, 1000);

    X.on('event', function(ev) {
        X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 10000000, function(err, prop) {
            if (prop.type == X.atoms.STRING)
               prop.data = prop.data.toString();
            console.log(prop.data);
        }); 
    });
    X.on('end', function() {
        clearInterval(interval);
    });
});
