var core = require('./xcore');
var em = require('./eventmask').eventMask;
var keysyms = require('./keysyms');

module.exports.createClient = core.createClient;
module.exports.eventMask = em;
module.exports.keySyms = keysyms;


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
