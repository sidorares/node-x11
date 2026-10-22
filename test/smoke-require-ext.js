const { describe, it } = require('node:test');
const fs = require('fs');
const assert = require('assert');

describe('all extension modules', () => {
  it('should not throw when require\'d', (t, done) => {
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

