var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

describe('CreateWindow request', function() {

  // keep for a while: this snippet helps to track global leak
  //global.__defineSetter__('a', function(v) {
  //    console.trace();
  //});

  var display;
  var X;
  beforeEach(function(done) {
      var client = x11.createClient(function(err, dpy) {
          if (!err) {
              display = dpy;
              X = display.client;
          }

          done(err);
      });
      client.on('error', done);
  });

  afterEach(function(done) {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('should exist as client member', function(done) {
      should.exist(X.CreateWindow);
      assert.equal(typeof X.CreateWindow, 'function');
      done();
  });

  it('result should present in windows tree', function(done) {
      var wid = X.AllocID();
      X.CreateWindow(wid, display.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
      X.QueryTree(display.screen[0].root, function(err, list) {
          if (err)
              done(err);
          var pos = list.children.indexOf(wid);
          assert.notEqual(pos, -1, 'can\'t find created window');
          done();
      });
  });

  it('should work with any kind of attributes too', function(done) {
      var wid = X.AllocID();
      X.CreateWindow(wid, display.screen[0].root, 0, 0, 1, 1, 0, 0, 0, 0, { overrideRedirect : true }); // 1x1 pixel window
      X.QueryTree(display.screen[0].root, function(err, list) {
          should.not.exist(err);
          list.children.should.containEql(wid);
          done();
      });
  });

  it('should emit CreateNotify event when', function(done) {
      var wid = X.AllocID();
      var root = display.screen[0].root;
      X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.SubstructureNotify });
      X.on('event', function(ev) {
        switch (ev.name) {
          case 'CreateNotify':
            ev.parent.should.equal(root);
            ev.wid.should.equal(wid);
            ev.x.should.equal(0);
            ev.y.should.equal(0);
            ev.width.should.equal(1);
            ev.height.should.equal(1);
            ev.borderWidth.should.equal(0);
            ev.overrideRedirect.should.equal(false);
          break;

          case 'MapNotify':
            ev.event.should.equal(root);
            ev.wid.should.equal(wid);
            ev.overrideRedirect.should.equal(false);
            X.UnmapWindow(wid);
          break;

          case 'UnmapNotify':
            ev.event.should.equal(root);
            ev.wid.should.equal(wid);
            ev.fromConfigure.should.equal(false);
            X.DestroyWindow(wid);
          break;

          case 'DestroyNotify':
            ev.event.should.equal(root);
            ev.wid.should.equal(wid);
            done();
          break;
        }
      });

      X.CreateWindow(wid, root, 0, 0, 1, 1); // 1x1 pixel window
      X.MapWindow(wid);
  })
});
