'use strict';

var uuid = require('node-uuid');
var Busboy = require('busboy');
var fs = require('fs-extra');
var path = require('path');

module.exports = function (config) {

  var TEMP_DIR = config.tempdir;

  var debug = config.debug;

  /**
   * Parses any incoming multipart form data via POST or PUT.
   *
   * @type Express Middleware
   */
  return function multiparser(req, res, next) {
    /* Parse only POST and PUT request with multipart form data */
    if ((req.method !== 'POST' && req.method !== 'PUT') || !req.is('multipart')) {
      return next();
    }

    var busboy = new Busboy({
      headers: req.headers
    });

    var parser = {
      finished: false,
      fields: 0,
      files: 0
    };

    req.files = [];
    req.body = {};

    /* Helper function to deal with asyncronisity */
    function complete() {
      if (parser.finished && req.files.length === parser.files && Object.keys(req.body).length === parser.fields) {
        debug("[Multiparser] Upload complete");
        next();
      }
    }

    /* Move uploaded files to the temp dir */
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
      parser.files++;

      var filepath = path.normalize(path.join(TEMP_DIR, uuid.v4() + path.extname(filename)));
      var writer = fs.createOutputStream(filepath);

      req.files.push({
        encoding: encoding,
        field: fieldname,
        path: filepath,
        type: mimetype,
        name: filename
      });

      writer.on('finish', function () {
        debug("[Multiparser] Wrote " + req.files.length + " of " + parser.files);

        complete();
      });

      writer.on('error', function (err) {
        debug("[Multiparser] File write stream error: " + filename);
        next(err);
      });

      file.on('error', function (err) {
        debug("[Multiparser] File read stream error: " + filename);
        next(err);
      });

      debug("[Multiparser] Saving uploaded file: " + filename);

      file.pipe(writer);
    });

    /* Append fields to the request body */
    busboy.on('field', function (field, value) {
      parser.fields++;

      /* Try to parse the field as JSON */
      try {
        req.body[field] = JSON.parse(value);
      } catch (e) {
        req.body[field] = value;
      }

      complete();
    });

    busboy.on('finish', function () {
      parser.finished = true;
      complete();
    });

    req.pipe(busboy);
  };

};
