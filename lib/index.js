'use strict';

/** Dependencies */
var type = require('type-of-is');
var uuid = require('node-uuid');
var Busboy = require('busboy');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');
var os = require('os');

/* Module config */
var STOR_DIR = path.normalize(path.join(process.env.HOME || process.env.USERPROFILE, 'fileman-storage'));
var TEMP_DIR = path.normalize(path.join(os.tmpDir(), 'uploads'));

/* Debug function */
var debug = function () {};

/**
 * Configures the module.
 *
 * Recieves a configuration and applies it.
 *
 * @param {Object} options The configurion options.
 */
function configure(params) {
  TEMP_DIR = path.normalize(params.tempdir) || TEMP_DIR;
  STOR_DIR = path.normalize(params.stordir) || STOR_DIR;

  if (type.is(params.debug, Boolean)) {
    debug = console.log;
  } else if (type.is(params.debug, Function)) {
    debug = params.debug;
  }
}

/**
 * Creates folders and generates a unique file name into the temp folder.
 *
 * @param {String} basepath The full path to store the file relative to the temp dir
 * @param {Function} done The callback
 */
function getTempPath(filename, done) {
  /* Create a unique filename but maintain the file's extension */
  var outfile = uuid.v4() + path.extname(filename);

  /* Ensure the path exists */
  mkdirp(TEMP_DIR, function (err) {
    if (err) {
      return done(err);
    }

    /* Send the destination full path */
    done(null, path.join(TEMP_DIR, outfile));
  });
}

/**
 * Moves an uploaded file to the specified folder and saves it into the database.
 *
 * @param {String} destpath The destination path to save the file into
 * @param {Object} file The file object obtained from the multipart form parser
 * @param {Function} done The done callback
 */
function save(tempfile, destpath, done) {
  var basepath = path.normalize(path.join(STOR_DIR, destpath));
  var outpath = path.normalize(path.join(basepath, path.basename(tempfile.path)));

  debug("Saving file to: %s", outpath);

  mkdirp(basepath, function (err) {
    if (err) {
      return done(err);
    }

    /* Create a read stream from the source file in the temp directory */
    var source = fs.createReadStream(tempfile.path);
    /* Create write stream to the output path */
    var dest = fs.createWriteStream(outpath);
    /* Create a crypto MD5 hasher for the file's data */
    var hash = crypto.createHash('md5');

    /* Obtain temp file stats to retrieve it's size */
    fs.stat(tempfile.path, function (err, stats) {
      if (err) {
        return done(err);
      }

      source.on('data', function (data) {
        /* Update the file's MD5 hash */
        hash.update(data, 'utf8');
      });

      source.on('end', function () {
        debug("Wrote file %s", outpath);

        /* Create the file's data */
        var filedata = {
          type: tempfile.type,
          name: tempfile.name,
          size: stats.size,
          path: outpath.replace(STOR_DIR, ''),
          md5: hash.digest('hex')
        };

        /* Send the filedata object */
        done(null, filedata);
      });

      source.on('error', function (err) {
        done(err);
      });

      source.pipe(dest);
    });

  });
}

/**
 * Resolves a file's full path relative to the storage dir.
 *
 * @param {String} path The relative path to the file
 *
 * @return {String} The full path to the file
 */
function resolve(filepath) {
  return path.normalize(path.join(STOR_DIR, filepath));
}

/**
 * Reads a file from the storage dir.
 *
 * @param {String} path The relative path to the file
 *
 * @return {ReadableStream} The read stream for the file
 */
function read(filepath) {
  return fs.createReadStream(resolve(filepath));
}

/**
 * Parses any incoming multipart form data.
 *
 * @type Express Middleware
 */
function multiparser(req, res, next) {
  /* Only post and put request with multipart form data */
  if ((req.method !== 'POST' && req.method !== 'PUT') || !req.is('multipart')) {
    return next();
  }

  var busboy = new Busboy({
    headers: req.headers
  });

  req.files = [];
  req.body = {};

  /* Move uploaded files to the temp dir */
  busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
    /* Get and esure the temp uploads folder exists */
    getTempPath(filename, function (err, destpath) {
      if (err) {
        return next(err);
      }

      file.on('end', function () {
        debug("Wrote temp file: %s", destpath);

        /* Add the saved file to the request files array */
        req.files.push({
          type: mimetype,
          name: filename,
          path: destpath
        });
      });

      file.on('error', function (err) {
        next(err);
      });

      file.pipe(fs.createWriteStream(destpath));
    });
  });

  /* Append fields to the request body */
  busboy.on('field', function (fieldname, val) {
    try {
      req.body[fieldname] = JSON.parse(val);
    } catch (ex) {
      req.body[fieldname] = val;
    }
  });

  busboy.on('finish', function () {
    next();
  });

  req.pipe(busboy);
}

/**
 * Waits until the response is finished and unliks any uploaded files from the temp folder.
 *
 * @type Express Middleware
 */
function uploadedFilesCleaner(req, res, next) {
  res.on('finish', function () {
    /* Check if files qhere uploaded */
    if (type.is(req.files, Array) && req.files.length) {
      debug("Cleaning %d uploaded files...", req.files.length);

      /* Unlink each file */
      req.files.forEach(function (file) {
        fs.unlink(file.path, function (err) {
          if (err) {
            debug(err);
          }
        });
      });
    }
  });

  next();
}

/** Public methods */
module.exports.uploadedFilesCleaner = uploadedFilesCleaner;
module.exports.multiparser = multiparser;
module.exports.getTempPath = getTempPath;
module.exports.configure = configure;
module.exports.ensurePath = mkdirp;
module.exports.resolve = resolve;
module.exports.save = save;
module.exports.read = read;
