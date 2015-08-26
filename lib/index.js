'use strict';

/* Dependencies */
var type = require('type-of-is');
var mmmagic = require('mmmagic');
var uuid = require('node-uuid');
var Busboy = require('busboy');
var crypto = require('crypto');
var fs = require('fs-extra');
var path = require('path');
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
 * Moves an uploaded file to the specified folder and saves it into the database.
 *
 * @param {String} destpath The destination path to save the file into
 * @param {Object} file The file object obtained from the multipart form parser
 * @param {Function} done The done callback
 */
function save(tempfile, destpath, done) {
  debug("Save: Moving temp file " + tempfile.path);

  /* Obtain temp file stats to retrieve it's size */
  fs.stat(tempfile.path, function (err, stats) {
    if (err) {
      debug("Save: get file stats error!");
      debug(err);
      return done(err);
    }

    var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);

    magic.detectFile(tempfile.path, function (err, mimetype) {
      if (err) {
        debug("Save: detect file mime type error!");
        return done(err);
      }

      debug("Detected type: " + mimetype + " / Uploaded type: " + tempfile.type);
      debug("Saving file to: " + outpath);

      var basepath = path.normalize(path.join(STOR_DIR, destpath));
      var outpath = path.normalize(path.join(basepath, path.basename(tempfile.path)));
      /* Create a read stream from the source file in the temp directory */
      var source = fs.createReadStream(tempfile.path);
      /* Create output (write) stream to the output path */
      var ws = fs.createOutputStream(outpath);
      /* Create a crypto MD5 hasher for the file's data */
      var hash = crypto.createHash('md5');

      source.on('data', function (data) {
        /* Update the file's MD5 hash */
        hash.update(data, 'utf8');
      });

      source.on('end', function () {
        debug("Wrote file: " + outpath);

        /* Create the file's data */
        var filedata = {
          path: outpath.replace(STOR_DIR, ''),
          encoding: tempfile.encoding,
          md5: hash.digest('hex'),
          name: tempfile.name,
          size: stats.size,
          type: mimetype
        };

        /* Send the filedata object */
        done(null, filedata);
      });

      source.on('error', function (err) {
        debug("Save: file stream write error!");
        done(err);
      });

      source.pipe(ws);
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
 * Parses any incoming multipart form data via POST or PUT.
 *
 * @type Express Middleware
 */
function multiparser(req, res, next) {
  /* Parse only POST and PUT request with multipart form data */
  if ((req.method !== 'POST' && req.method !== 'PUT') || !req.is('multipart')) {
    return next();
  }

  var busboy = new Busboy({
    headers: req.headers
  });

  var fields = 0;
  var files = 0;

  req.files = [];
  req.body = {};

  /* Helper function to deal with asynchronicity */
  function complete() {
    if (req.files.length === files && Object.keys(req.body).length === fields) {
      next();
    }
  }

  /* Move uploaded files to the temp dir */
  busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
    files++;

    var filepath = path.normalize(path.join(TEMP_DIR, uuid.v4() + path.extname(filename)));
    var ws = fs.createOutputStream(filepath);

    /* Wait until the uploaded temp file is written */
    ws.on('finish', function () {
      /* Add the saved file to the request files array */
      req.files.push({
        encoding: encoding,
        field: fieldname,
        path: filepath,
        type: mimetype,
        name: filename
      });

      complete();
    });

    ws.on('error', function (err) {
      debug("[Mutiparse] File stream write error: " + filepath);
      next(err);
    });

    file.on('error', function (err) {
      debug("[Mutiparse] File upload error: " + filename);
      next(err);
    });

    file.pipe(ws);
  });

  /* Append fields to the request body */
  busboy.on('field', function (field, value) {
    fields++;

    /* Try to parse the field as JSON */
    try {
      req.body[field] = JSON.parse(value);
    } catch (e) {
      req.body[field] = value;
    }

    complete();
  });

  busboy.on('finish', complete);

  req.pipe(busboy);
}

/**
 * Uploads and saves all files in the request to the folder relative to the STOR_DIR.
 *
 * @type Express Middleware
 */
function uploader(relpath) {
  return function (req, res, next) {
    var saved = [];

    req.files.forEach(function (file) {
      save(file, path.normalize(relpath), function (err, filedata) {
        if (err) {
          debug("[Uploader] File save error!");
          return next(err);
        }

        saved.push(filedata);

        if (saved.length === req.files.length) {
          res.send(saved);
        }
      });
    });
  };
}

/**
 * Downloads a file from it's path relative to the STOR_DIR folder.
 *
 * @type Express Middleware
 */
function downloader(req, res, next) {
  if (!req.query.path && !req.params.path) {
    return res.status(400).end();
  }

  var querypath = req.query.path || req.params.path;
  var resolved = resolve(querypath);

  fs.exists(resolved, function (exists) {
    if (!exists) {
      return res.status(404).end();
    }

    fs.stat(resolved, function (err, stats) {
      if (err) {
        debug("[Downloader] Get file stats error!");
        return next(err);
      }

      var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);

      magic.detectFile(resolved, function (err, mimetype) {
        if (err) {
          debug("[Downloader] Get file mimetype error: " + resolved);
          return next(err);
        }

        var hash = crypto.createHash('md5');
        var rs = read(querypath);

        rs.on('data', function (data) {
          hash.update(data, 'utf8');
        });

        rs.on('error', function (err) {
          debug("[Downloader] File read stream error: " + resolved);
          next(err);
        });

        rs.on('end', function () {
          res.set({
            'Content-Type': mimetype,
            'Content-Length': stats.size,
            'Cache-Control': 'max-age=31536000',
            'Last-Modified': stats.mtime,
            'ETag': hash.digest('hex')
          });

          read(querypath).pipe(res);
        });

      });
    });
  });
}

/**
 * Waits until the response is finished and unliks any uploaded files from the temp folder.
 *
 * @type Express Middleware
 */
function cleaner(req, res, next) {
  res.on('finish', function () {
    /* Check if files qhere uploaded */
    if (type.is(req.files, Array) && req.files.length) {
      debug("[Cleaner] Removing " + req.files.length + " uploaded files...");

      /* Unlink each file */
      req.files.forEach(function (file) {
        fs.remove(file.path, function (err) {
          if (err) {
            debug("[Cleaner] Couldn't clean uploaded file");
            debug(file);
            debug(err);
          }
        });
      });
    }
  });

  next();
}

/** Public properties */
module.exports.stordir = (function () {
  return STOR_DIR;
}());

module.exports.tempdir = (function () {
  return TEMP_DIR;
}());

/** Public methods */
module.exports.multiparser = multiparser;
module.exports.downloader = downloader;
module.exports.ensure = fs.ensureDir;
module.exports.configure = configure;
module.exports.uploader = uploader;
module.exports.resolve = resolve;
module.exports.cleaner = cleaner;
module.exports.save = save;
module.exports.read = read;
