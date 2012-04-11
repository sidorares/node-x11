var x11 = require('../../lib/x11');
x11.createClient(function(display) {
   console.log('succesfully connected to \"' + display.vendor + '\" server');
   display.client.terminate();
});
