var fs = require('fs');
var assert = require('assert');

describe('all extension modules', function() {
  it('should not throw when require\'d', function(done) {
    var extFolder = __dirname + '/../lib/ext';
    fs.readdir(extFolder, function(err, list) {
      assert.ifError(err);
      list.forEach(function(name) {
        var m = require(extFolder + '/' + name);
      });
      done();
    });
  });
})

