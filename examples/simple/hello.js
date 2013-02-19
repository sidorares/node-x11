var x11 = require('../../lib');
x11.createClient(function(err, display) {
   console.log('succesfully connected to \"' + display.vendor + '\" server');
   display.client.terminate();
});
