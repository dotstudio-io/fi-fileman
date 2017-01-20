'use strict';

const Parser = require('./parser');
const Busboy = require('busboy');

const MULTIPART = 'multipart';
const COMPLETE = 'complete';
const FINISH = 'finish';
const ERROR = 'error';
const FIELD = 'field';
const FILE = 'file';
const POST = 'POST';
const PUT = 'PUT';

/**
 * Parses any incoming multipart form data via POST or PUT.
 *
 * @type Express Middleware
 */
module.exports = (tempdir) => function multiparser(req, res, next) {
  /* Parse only POST and PUT request with multipart form data */
  if ((req.method !== POST && req.method !== PUT) || !req.is(MULTIPART)) {
    return next();
  }

  req.files = [];
  req.body = {};

  var parser = new Parser(tempdir);
  var busboy = new Busboy({
    headers: req.headers
  });

  /* Move uploaded files to the temp dir */
  busboy.on(FILE, (fieldname, file, filename, encoding, mimetype) => {
    parser.onFile(fieldname, file, filename, encoding, mimetype);
  });

  /* Append fields to the request body */
  busboy.on(FIELD, (field, value) => {
    parser.onField(field, value);
  });

  /* Busboy has finished */
  busboy.on(FINISH, () => {
    parser.onFinish();
  });

  parser.on(FILE, (data) => {
    req.files.push(data);
  });

  parser.on(FIELD, (field, value) => {
    req.body[field] = value;
  });

  parser.on(COMPLETE, () => {
    var isComplete = Object.keys(req.body).length === parser.fields &&
      req.files.length === parser.files &&
      parser.finished;

    if (isComplete) {
      next();
    }
  });

  parser.on(ERROR, next);

  return req.pipe(busboy);
};
