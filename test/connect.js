var x11 = require('../lib/x11');
//var sinon = require('sinon');
var should = require('should');

describe("Client", function() {

  beforeEach(function() {
  });

  afterEach(function() {
  });

  it("calls first createClient parameter with display object", function(done) {
    var client = x11.createClient(function(display) {
      should.exist(display);
      done();
    });
  });
});
