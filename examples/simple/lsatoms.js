var x11 = require('../../lib');
x11.createClient(function(err, display) {
  var maxstd = 0;
  var atomName;
  for (atomName in display.atoms)
  {
    var id = display.atoms[atomName];
    console.log(id + '\t' + atomName);
    if (id > maxstd)
       maxstd = id;
  }
  (
    function getAtoms(atomId)
    {
        display.client.GetAtomName(atomId, function(err, atom) {
            if (err) {
                display.client.terminate();
                return true;
            } else {
                console.log(atomId + '\t' +  atom);
                getAtoms(atomId +1);
            }
        });
    }
  )(maxstd+1);
});
