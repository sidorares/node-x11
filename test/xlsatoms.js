var x11 = require('../lib/x11');

var xclient = x11.createClient();
var atomId = 10;
xclient.on('connect', function(display) {
    var X = this;
    function listAtoms()
    {
        function getAtom(a)
        {
            X.GetAtomName(a, function(str) {
                if (typeof str != 'string') // 'Bad atom' error
                {
                    X.terminate();
                    return;
                }
                console.log(a + ' ' + str);
                listAtoms();
            });
        }
        getAtom(atomId);
        atomId++;
    }
    listAtoms();    
});
