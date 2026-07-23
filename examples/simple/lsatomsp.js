const x11 = require('../../lib');
x11.createClient((err, display) => {
  let maxstd = 0;
  let atomName;
  for (atomName in display.client.atoms)
  {
    const id = display.client.atoms[atomName];
    console.log(`${id}\t${atomName}`);
    if (id > maxstd)
       maxstd = id;
  }
  (
    function getAtoms(atomIdStart, atomIdEnd)
    {
        let atomId;
        let numInBatch = atomIdEnd - atomIdStart;
        for (atomId = atomIdStart; atomId < atomIdEnd; atomId++)
        {
            (id => {
            display.client.GetAtomName(id, (err, atom) => {
                if (err) {
                    display.client.terminate();
                    return true;
                } else {
                    console.log(`${id}\t${atom}`);
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
