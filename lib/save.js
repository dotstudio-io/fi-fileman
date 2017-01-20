'use strict';

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const is = require('fi-is');

const ERR_SAVE_ARGUMENTS = '[Save] This function must be called with at least 2 arguments, a fileinfo [Object] and a callback [Function]';
const ERR_SAVE_PATH = '[Save] The second argument must be a [String] to the path relative to the stordir';
const ERR_SAVE_STORDIR = '[Save] The second argument must be a [String] with the stordir path';
const ERR_SAVE_CALLBACK = '[Save] The last argument must be a callback [Function]';
const ERR_SAVE_FILEINFO = '[Save] The first argument must be a fileinfo [Object]';

const FINISH = 'finish';
const ERROR = 'error';
const DATA = 'data';
const UTF8 = 'utf8';
const NOTHING = '';
const HEX = 'hex';
const MD5 = 'md5';

/**
 * Moves an uploaded file to the specified stordir sub folder.
 *
 * @param {String} destpath The destination path to save the file into.
 * @param {Object} file The file object obtained from the multipart form parser.
 * @param {Function} done The done callback.
 */
module.exports = function () {
  if (arguments.length < 2) {
    throw new Error(ERR_SAVE_ARGUMENTS);
  }

  var fileinfo, stordir, destpath, done;

  if (is.function(arguments[arguments.length - 1])) {
    done = arguments[arguments.length - 1];
  } else {
    throw new Error(ERR_SAVE_CALLBACK);
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

  /* Obtain temp file stats to retrieve it's size */
  fs.stat(fileinfo.path, (err, stats) => {
    if (err) {
      return done(err);
    }

    var basepath = path.normalize(path.join(stordir, destpath));
    var fullpath = path.normalize(path.join(basepath, path.basename(fileinfo.path)));

    /* Create a read stream from the source file in the temp directory */
    var reader = fs.createReadStream(fileinfo.path);
    /* Create output (write) stream to the output path */
    var writer = fs.createOutputStream(fullpath);
    /* Create a crypto MD5 hasher for the file's data */
    var hash = crypto.createHash(MD5);

    reader.on(DATA, (data) => {
      /* Update the file's MD5 hash */
      hash.update(data, UTF8);
    });

    writer.on(FINISH, () => {
      /* Send the new fileinfo object */
      done(null, {
        name: is.string(fileinfo.name) && fileinfo.name || null,
        path: fullpath.replace(stordir, NOTHING),
        encoding: fileinfo.encoding,
        type: fileinfo.mimetype,
        md5: hash.digest(HEX),
        stats: stats
      });
    });

    reader.on(ERROR, done);

    writer.on(ERROR, done);

    reader.pipe(writer);
  });

};
