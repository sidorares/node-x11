var x11 = require('../lib/x11');

var xclient = x11.createClient();
var atomId = 1;
xclient.on('connect', function(display) {
    var X = this;
    function listAtoms()
    {
        function getAtom(a)
        {
            X.GetAtomName({ atom: a }, function(str) {
                if (a == 1)
                    console.log('module.exports = {')
                if (a != 68)
                    console.log('    %s: %d,', str.name, a);
                else
                    console.log('    %s: %d\n}', str.name, a);
                listAtoms();
            });
        }
        if (atomId <= 68)
           getAtom(atomId);
        else
           X.terminate();
        atomId++;
    }
    listAtoms();    
});
