'use strict';

const { XServer, createServer } = require('./server');
const { createStreamPair } = require('./streampair');

module.exports = { XServer, createServer, createStreamPair };
