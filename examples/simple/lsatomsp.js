var x11 = require('../../lib');
x11.createClient(function(err, display) {
  var maxstd = 0;
  var atomName;
  for (atomName in display.client.atoms)
  {
    var id = display.client.atoms[atomName];
    console.log(id + '\t' + atomName);
    if (id > maxstd)
       maxstd = id;
  }
  (
    function getAtoms(atomIdStart, atomIdEnd)
    {
        var atomId;
        var numInBatch = atomIdEnd - atomIdStart;
        for (atomId = atomIdStart; atomId < atomIdEnd; atomId++)
        {
            (function(id) {
            display.client.GetAtomName(id, function(err, atom) {
                if (err) {
                    display.client.terminate();
                    return true;
                } else {
                    console.log(id + '\t' +  atom);
                    numInBatch--;
                    if (numInBatch === 0) { 
                        getAtoms(atomIdStart + 100, atomIdEnd+ 100);
                    }
                }
            });
            })(atomId);
        }
    }
  )(maxstd+1, maxstd+100);
});
