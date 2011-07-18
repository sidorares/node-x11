var core = require('./xcore');
var em = require('./eventmask').eventMask;
module.exports.createClient = core.createClient;
module.exports.eventMask = em;