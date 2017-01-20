'use strict';

const fs = require('fs-extra');
const path = require('path');
const is = require('fi-is');
const os = require('os');

const multiparserFn = require('./multiparser');
const saveFn = require('./save');

const ERR_RESOLVE_PARAM = 'The argument must be a path [String] or a fileinfo [Object]';
const ERR_CONFIG_PARAM = 'The config parameter must be an [Object]!';

const DEFAULT_STORDIR = 'fileman-storage';
const DEFAULT_TEMPDIR = 'fileman-uploads';
const STORDIR = 'stordir';
const TEMPDIR = 'tempdir';
const FINISH = 'finish';

function Fileman() {
  this.defaults = {
    stordir: path.normalize(path.join(process.env.HOME || process.env.USERPROFILE, DEFAULT_STORDIR)),
    tempdir: path.normalize(path.join(os.tmpDir(), DEFAULT_TEMPDIR))
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
  if (!is.object(config)) {
    throw new Error(ERR_CONFIG_PARAM);
  }

  if (is.string(config.tempdir)) {
    this.config.tempdir = path.normalize(config.tempdir);
  }

  if (is.string(config.stordir)) {
    this.config.stordir = path.normalize(config.stordir);
  }
};

/**
 * Multipart form data parser.
 *
 * @return Express Middleware
 */
Fileman.prototype.multiparser = function() {
  var tempdir = this.get(TEMPDIR);

  return multiparserFn(tempdir);
};

/**
 * Waits until the response is finished and unliks any uploaded files from the temp folder.
 *
 * @type Express Middleware.
 */
Fileman.prototype.cleaner = function() {
  return function(req, res, next) {
    res.on(FINISH, () => {
      /* Check if files qhere uploaded */
      if (is.array(req.files) && req.files.length) {
        /* Unlink each file */
        req.files.forEach(function(file) {
          if (is.string(file.path)) {
            fs.remove(file.path);
          }
        });
      }
    });

    next();
  };
};

/**
 * Resolves the full path relative to the stordir of a file.
 *
 * @param {Mixed} param The relative path to the file as a [String] or a fileinfo [Object].
 *
 * @return {String} The resolved path.
 */
Fileman.prototype.resolve = function resolve(param) {
  var stordir = this.get(STORDIR);
  var filepath;

  if (is.string(param)) {
    filepath = param;
  } else if (is.object(param) && is.string(param.path)) {
    filepath = param.path;
  } else {
    throw new Error(ERR_RESOLVE_PARAM);
  }

  return path.normalize(path.join(stordir, filepath));
};

/**
 * Reads a file from the storage dir.
 *
 * @param {Mixed} param The relative path to the file as a [String] or a fileinfo [Object].
 *
 * @return {Stream} The resulting read Stream.
 */
Fileman.prototype.read = function read(param) {
  return fs.createReadStream(this.resolve(param));
};

/**
 * Saves a file to the storage dir.
 *
 * @param {String} path The relative path to the file.
 */
Fileman.prototype.save = function save(fileinfo, destpath, done) {
  var stordir = this.get(STORDIR);

  saveFn(fileinfo, stordir, destpath, done);
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
