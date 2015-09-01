'use strict';

var type = require('type-of-is');
var fs = require('fs-extra');
var path = require('path');
var os = require('os');

function Fileman() {
  this.defaults = {
    stordir: path.normalize(path.join(process.env.HOME || process.env.USERPROFILE, 'fileman-storage')),
    tempdir: path.normalize(path.join(os.tmpDir(), 'fileman-uploads'))
  };

  this.config = {};
}

/**
 * Retrieves a configuration setting or its default.
 *
 * @return {Mixed} The value of the configuration field.
 */
Fileman.prototype.get = function get(field) {
  return this.config[field] || this.defaults[field];
};

/**
 * Configures the module.
 *
 * Recieves a configuration and applies it.
 *
 * @param {Object} config The configuration object.
 */
Fileman.prototype.configure = function configure(config) {
  if (config && !type.is(config, Object)) {
    throw new Error("The config parameter must be an [Object]!");
  }

  if (type.is(config.tempdir, String)) {
    this.config.tempdir = path.normalize(config.tempdir);
  }

  if (type.is(config.stordir, String)) {
    this.config.stordir = path.normalize(config.stordir);
  }
};

/**
 * Multipart form data parser.
 *
 * @return Express Middleware
 */
Fileman.prototype.multiparser = function () {
  var tempdir = this.get('tempdir');

  return require('./multiparser')(tempdir);
};

/**
 * Waits until the response is finished and unliks any uploaded files from the temp folder.
 *
 * @type Express Middleware.
 */
Fileman.prototype.cleaner = function () {
  return function (req, res, next) {
    res.on('finish', function () {
      /* Check if files qhere uploaded */
      if (type.is(req.files, Array) && req.files.length) {
        /* Unlink each file */
        req.files.forEach(function (file) {
          if (type.is(file.path, String)) {
            fs.removeSync(file.path);
          }
        });
      }
    });

    next();
  };
};

/**
 * Resolves the full pat relative to the stordir of a file.
 *
 * @param {String} path The relative path to the file.
 *
 * @return {String} The path.
 */
Fileman.prototype.resolve = function resolve(filepath) {
  var stordir = this.get('stordir');

  filepath = filepath || '';

  return path.normalize(path.join(stordir, filepath));
};

/**
 * Reads a file from the storage dir.
 *
 * @param {String} path The relative path to the file.
 */
Fileman.prototype.read = function read(filepath) {
  return fs.createReadStream(this.resolve(filepath));
};

/**
 * Saves a file to the storage dir.
 *
 * @param {String} path The relative path to the file.
 */
Fileman.prototype.save = function save(fileinfo, destpath, done) {
  var stordir = this.get('stordir');

  require('./save')(fileinfo, stordir, destpath, done);
};

/**
 * Creates a new Fileman instance.
 *
 * @return {Fileman}
 */
Fileman.prototype.anew = function anew() {
  return new Fileman();
};

module.exports = new Fileman();
