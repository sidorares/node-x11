const x11 = require('../../lib');
x11.createClient((err, display) => {
  let maxstd = 0;
  let atomName;
  for (atomName in display.atoms)
  {
    const id = display.atoms[atomName];
    console.log(`${id}\t${atomName}`);
    if (id > maxstd)
       maxstd = id;
  }
  (
    function getAtoms(atomId)
    {
        display.client.GetAtomName(atomId, (err, atom) => {
            if (err) {
                display.client.terminate();
                return true;
            } else {
                console.log(`${atomId}\t${atom}`);
                getAtoms(atomId +1);
            }
        });
    }
  )(maxstd+1);
});
