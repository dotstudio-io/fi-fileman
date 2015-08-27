'use strict';

var type = require('type-of-is');
var path = require('path');
var os = require('os');

var config = {
  stordir: path.normalize(path.join(process.env.HOME || process.env.USERPROFILE, 'fileman-storage')),
  tempdir: path.normalize(path.join(os.tmpDir(), 'fileman-uploads')),

  debug: function () {}
};

/**
 * When the module has not been initialized.
 */
function uninit() {
  throw new Error("Please initialize Fileman first");
}

/**
 * Configures the module.
 *
 * Recieves a configuration and applies it.
 *
 * @param {Object} options The configurion options.
 */
function init(params) {
  if (type.is(params.tempdir, String)) {
    config.tempdir = path.normalize(params.tempdir);
  }

  if (type.is(params.stordir, String)) {
    config.stordir = path.normalize(params.stordir);
  }

  if (type.is(params.debug, Boolean)) {
    config.debug = console.log;
  } else if (type.is(params.debug, Function)) {
    config.debug = params.debug;
  }

  module.exports.multiparser = require('./multiparser')(config);
  module.exports.resolve = require('./resolve')(config);
  module.exports.cleaner = require('./cleaner')(config);
  module.exports.ensure = require('fs-extra').ensureDir;
  module.exports.save = require('./save')(config);
  module.exports.read = require('./read')(config);
}

module.exports.multiparser = uninit;
module.exports.resolve = uninit;
module.exports.cleaner = uninit;
module.exports.ensure = uninit;
module.exports.save = uninit;
module.exports.read = uninit;
module.exports.init = init;
