'use strict';

var is = require('fi-is');
var crypto = require('crypto');
var fs = require('fs-extra');
var path = require('path');

/**
 * Moves an uploaded file to the specified stordir sub folder.
 *
 * @param {String} destpath The destination path to save the file into
 * @param {Object} file The file object obtained from the multipart form parser
 * @param {Function} done The done callback
 */
module.exports = function save() {
  if (arguments.length < 2) {
    throw new Error("[Save] This function must be called with at least 2 arguments, a fileinfo [Object] and a callback [Function]");
  }

  var fileinfo, stordir, destpath, done;

  if (is.function(arguments[arguments.length - 1])) {
    done = arguments[arguments.length - 1];
  } else {
    throw new Error("[Save] The last argument must be a callback [Function]");
  }

  if (is.object(arguments[0])) {
    fileinfo = arguments[0];
  } else {
    throw new Error("[Save] The first argument must be a fileinfo [Object]");
  }

  if (is.string(arguments[1])) {
    stordir = arguments[1];
  } else {
    throw new Error("[Save] The second argument must be a [String] with the stordir path");
  }

  if (is.string(arguments[2])) {
    destpath = arguments[2];
  } else {
    throw new Error("[Save] The second argument must be a [String] to the path relative to the stordir");
  }

  /* Obtain temp file stats to retrieve it's size */
  fs.stat(fileinfo.path, function(err, stats) {
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
    var hash = crypto.createHash('md5');

    reader.on('data', function(data) {
      /* Update the file's MD5 hash */
      hash.update(data, 'utf8');
    });

    writer.on('finish', function() {
      /* Send the new fileinfo object */
      done(null, {
        name: is.string(fileinfo.name) && fileinfo.name || null,
        path: fullpath.replace(stordir, ''),
        md5: hash.digest('hex'),
        encoding: fileinfo.encoding,
        type: fileinfo.mimetype,
        stats: stats
      });
    });

    reader.on('error', function(err) {
      done(err);
    });

    writer.on('error', function(err) {
      done(err);
    });

    reader.pipe(writer);
  });

};
