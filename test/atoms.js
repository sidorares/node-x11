var x11 = require('../lib/x11');

var xclient = x11.createClient();

xclient.on('connect', function(display) {
  var X = this;
  var hello = 'Hello, node.js';
  X.InternAtom({ only_if_exists: false, name: hello }, function(internResp) {
    console.log(internResp)
      X.GetAtomName({ atom: internResp.atom }, function(atomNameResp) {
        console.log(atomNameResp);
      });
  });
});
