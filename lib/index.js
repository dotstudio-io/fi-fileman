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
var TEMP_DIR = path.normalize(path.join(os.tmpDir(), 'fileman-uploads'));

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
function save() {
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
      var rs = fs.createReadStream(filedata.path);
      /* Create output (write) stream to the output path */
      var ws = fs.createOutputStream(outpath);
      /* Create a crypto MD5 hasher for the file's data */
      var hash = crypto.createHash('md5');

      rs.on('data', function (data) {
        /* Update the file's MD5 hash */
        hash.update(data, 'utf8');
      });

      rs.on('end', function () {
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

      rs.on('error', function (err) {
        debug("[Save] File stream write error: " + filedata.path);
        done(err);
      });

      rs.pipe(ws);
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

  var finished = false;
  var files = 0;

  req.files = [];
  req.body = {};

  /* Move uploaded files to the temp dir */
  busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
    files++;

    var filepath = path.normalize(path.join(TEMP_DIR, uuid.v4() + path.extname(filename)));
    var ws = fs.createOutputStream(filepath);

    ws.on('finish', function () {
      debug("[Multiparser] Wrote temporal uploaded file: " + filename);

      req.files.push({
        encoding: encoding,
        field: fieldname,
        path: filepath,
        type: mimetype,
        name: filename
      });

      if (finished && req.files.length === files) {
        next();
      }
    });

    ws.on('error', function (err) {
      next(err);
    });

    debug("[Multiparser] Saving uploaded file: " + filename);

    file.pipe(ws);
  });

  /* Append fields to the request body */
  busboy.on('field', function (field, value) {
    /* Try to parse the field as JSON */
    try {
      req.body[field] = JSON.parse(value);
    } catch (e) {
      req.body[field] = value;
    }
  });

  busboy.on('finish', function () {
    finished = true;
  });

  req.pipe(busboy);
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
module.exports.ensure = fs.ensureDir;
module.exports.configure = configure;
module.exports.resolve = resolve;
module.exports.cleaner = cleaner;
module.exports.save = save;
module.exports.read = read;
