var core = require('./xcore');
var em = require('./eventmask').eventMask;
var server = require('./xserver');

module.exports.createClient = core.createClient;
module.exports.createServer = server.createServer;
module.exports.eventMask = em;

Object.defineProperty(module.exports, 'keySyms', {
  enumerable: true,
  get: function() { return require('./keysyms'); }
});

Object.defineProperty(module.exports, 'gcFunction', {
  enumerable: true,
  get: function() { return require('./gcfunction'); }
});

//TODO:
// keepe everything in namespace for consistensy (eventMask, keySyms, class, destination ...
// or put most used constants to top namespace? (currently class and destination in top) 

// basic constants

// class
module.exports.CopyFromParent = 0;
module.exports.InputOutput = 1;
module.exports.InputOnly = 2;

// destination 
module.exports.PointerWindow = 0;
module.exports.InputFocus = 1;


// TODO
module.exports.bitGravity = {
};

module.exports.winGravity = {
};
