'use strict';

var mmmagic = require('mmmagic');
var type = require('type-of-is');
var crypto = require('crypto');
var fs = require('fs-extra');
var path = require('path');

module.exports = function (config) {

  var STOR_DIR = config.stordir;

  var debug = config.debug;

  /**
   * Moves an uploaded file to the specified folder and saves it into the database.
   *
   * @param {String} destpath The destination path to save the file into
   * @param {Object} file The file object obtained from the multipart form parser
   * @param {Function} done The done callback
   */
  return function save() {
    if (arguments.length < 2) {
      throw new Error("[Save] This function must be called with at least 2 arguments, a filedata [Object] and a callback [Function]");
    }

    var filedata, destpath, done;

    if (type.is(arguments[arguments.length - 1], Function)) {
      done = arguments[arguments.length - 1];
    } else {
      throw new Error("[Save] The last argument must be a callback [Function]");
    }

    if (type.is(arguments[0], Object)) {
      filedata = arguments[0];
    } else {
      throw new Error("[Save] The first argument must be a filedata [Object]");
    }

    if (arguments.length === 3 && type.is(arguments[1], String)) {
      destpath = arguments[1];
    } else {
      throw new Error("[Save] The second argument must be a [String] to the path relative to the stordir");
    }

    debug("[Save] Moving temp file " + filedata.path);

    /* Obtain temp file stats to retrieve it's size */
    fs.stat(filedata.path, function (err, stats) {
      if (err) {
        debug("[Save] Get file stats error!");
        return done(err);
      }

      var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME);

      magic.detectFile(filedata.path, function (err, mime) {
        if (err) {
          debug("[Save] Detect file mime type error: " + filedata.path);
          return done(err);
        }

        mime = mime.split(/;?\s+?charset=/);

        var basepath = path.normalize(path.join(STOR_DIR, destpath));
        var outpath = path.normalize(path.join(basepath, path.basename(filedata.path)));
        var encoding = mime[1];
        var mimetype = mime[0];

        debug("[Save] Saving file to: " + outpath);

        /* Create a read stream from the source file in the temp directory */
        var reader = fs.createReadStream(filedata.path);
        /* Create output (write) stream to the output path */
        var writer = fs.createOutputStream(outpath);
        /* Create a crypto MD5 hasher for the file's data */
        var hash = crypto.createHash('md5');

        reader.on('data', function (data) {
          /* Update the file's MD5 hash */
          hash.update(data, 'utf8');
        });

        writer.on('finish', function () {
          debug("[Save] Wrote file: " + outpath);

          /* Send the new filedata object */
          done(null, {
            name: type.is(filedata.name, String) && filedata.name || null,
            path: outpath.replace(STOR_DIR, ''),
            md5: hash.digest('hex'),
            encoding: encoding,
            size: stats.size,
            type: mimetype
          });
        });

        reader.on('error', function (err) {
          debug("[Save] File stream read error: " + filedata.path);
          done(err);
        });

        writer.on('error', function (err) {
          debug("[Save] File stream write error: " + filedata.path);
          done(err);
        });

        reader.pipe(writer);
      });
    });
  };

};
