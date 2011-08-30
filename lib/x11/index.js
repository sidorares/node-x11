var core = require('./xcore');
var em = require('./eventmask').eventMask;
var keysyms = require('./keysyms');

module.exports.createClient = core.createClient;
module.exports.eventMask = em;
module.exports.keySyms = keysyms;