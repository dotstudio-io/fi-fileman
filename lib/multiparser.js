'use strict';

var uuid = require('node-uuid');
var Busboy = require('busboy');
var fs = require('fs-extra');
var path = require('path');

module.exports = function multiparser(tempdir) {

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
      files: {
        uploaded: 0,
        saved: 0
      }
    };

    req.files = [];
    req.body = {};

    /* Helper function to deal with asyncronisity */
    function complete() {
      if (parser.finished && parser.files.uploaded === parser.files.saved && Object.keys(req.body).length === parser.fields) {
        next();
      }
    }

    /* Move uploaded files to the temp dir */
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
      parser.files.uploaded++;

      var filepath = path.normalize(path.join(tempdir, uuid.v4() + path.extname(filename)));
      var writer = fs.createOutputStream(filepath);

      req.files.push({
        encoding: encoding,
        mimetype: mimetype,
        field: fieldname,
        path: filepath,
        type: mimetype,
        name: filename,
      });

      writer.once('finish', function () {
        parser.files.saved++;
        complete();
      });

      writer.once('error', function (err) {
        next(err);
      });

      file.once('error', function (err) {
        next(err);
      });

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

    busboy.once('finish', function () {
      parser.finished = true;
      complete();
    });

    req.pipe(busboy);
  };

};
