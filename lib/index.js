const core = require('./xcore');
const em = require('./eventmask').eventMask;
const coreEvents = require('./generated/core-events');

module.exports.createClient = core.createClient;
module.exports.registerDisplayProtocol = core.registerDisplayProtocol;
module.exports.parseDisplay = core.parseDisplay;
module.exports.eventMask = em;
// build the 32 wire bytes of an event for SendEvent; eventTypes maps event
// names to their protocol numbers
module.exports.packEvent = coreEvents.packEvent;
module.exports.eventTypes = coreEvents.eventTypes;

// lazy: the server pulls in `net` at require time, which browser bundles lack
Object.defineProperty(module.exports, 'createServer', {
  enumerable: true,
  get() { return require('./xserver').createServer; }
});

Object.defineProperty(module.exports, 'keySyms', {
  enumerable: true,
  get() { return require('./keysyms'); }
});

Object.defineProperty(module.exports, 'gcFunction', {
  enumerable: true,
  get() { return require('./gcfunction'); }
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
