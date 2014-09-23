var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('damage', function(err, Damage) {
        console.log(Damage);
        var id = parseInt(process.argv[2]);
        var damage = X.AllocID();
        Damage.Create(damage, id, Damage.ReportLevel.NonEmpty);
        X.on('event', function(ev) {
          Damage.Subtract(damage, 0, 0);
          console.log(ev);
        });
    });
    X.on('error', function(err) { console.log(err); });

});
