var x11 = require('../lib/x11');

var xclient = x11.createClient();
xclient.on('connect', function(display) {
    var X = this;
    X.ListHosts(function(resp) {
      console.log('ListHosts', JSON.stringify(resp, null, 2))
    })
});
