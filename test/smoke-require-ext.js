const fs = require('fs');
const assert = require('assert');

describe('all extension modules', () => {
  it('should not throw when require\'d', done => {
    const extFolder = `${__dirname}/../lib/ext`;
    fs.readdir(extFolder, (err, list) => {
      assert.ifError(err);
      list.forEach(name => {
        const m = require(`${extFolder}/${name}`);
      });
      done();
    });
  });
})

