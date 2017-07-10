'use strict';

const md5File = require('md5-file/promise');
const fs = require('fs-extra');
const path = require('path');
const is = require('fi-is');

const ERR_SAVE_ARGUMENTS = '[fi-fileman/save] This function must be called with at least 2 arguments, a fileinfo [Object] and a callback [Function]';
const ERR_SAVE_PATH = '[fi-fileman/save] The second argument must be a [String] to the path relative to the stordir';
const ERR_SAVE_STORDIR = '[fi-fileman/save] The second argument must be a [String] with the stordir path';
const ERR_SAVE_FILEINFO = '[fi-fileman/save] The first argument must be a fileinfo [Object]';

const NOTHING = '';

const noop = function noop() {};

/**
 * Moves an uploaded file to the specified stordir sub folder.
 *
 * @param {String} destpath The destination path to save the file into.
 * @param {Object} file The file object obtained from the multipart form parser.
 * @param {Function} done The done callback.
 */
module.exports = function save() {
  if (arguments.length < 2) {
    throw new Error(ERR_SAVE_ARGUMENTS);
  }

  var fileinfo, stordir, destpath, done;

  if (is.function(arguments[arguments.length - 1])) {
    done = arguments[arguments.length - 1];
  } else {
    done = noop;
  }

  if (is.object(arguments[0])) {
    fileinfo = arguments[0];
  } else {
    throw new Error(ERR_SAVE_FILEINFO);
  }

  if (is.string(arguments[1])) {
    stordir = arguments[1];
  } else {
    throw new Error(ERR_SAVE_STORDIR);
  }

  if (is.string(arguments[2])) {
    destpath = arguments[2];
  } else {
    throw new Error(ERR_SAVE_PATH);
  }

  var basepath = path.normalize(path.join(stordir, destpath));
  var outpath = path.normalize(path.join(basepath, path.basename(fileinfo.path)));

  var finfo = {
    name: is.string(fileinfo.name) && fileinfo.name || null,
    path: outpath.replace(stordir, NOTHING),
    encoding: fileinfo.encoding,
    type: fileinfo.mimetype
  };

  /* Obtain temp file stats to retrieve it's size */
  return fs.stat(fileinfo.path).then((stats) => {
    finfo.stats = stats;
    return md5File(fileinfo.path);
  }).then((hash) => {
    finfo.md5 = hash;
    return fs.move(fileinfo.path, outpath);
  }).then(() => {
    done(null, finfo);
    return finfo;
  }).catch((err) => {
    fs.remove(outpath);
    done(err);
  });
};
