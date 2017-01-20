'use strict';

const Parser = require('./parser');
const Busboy = require('busboy');

const MULTIPART = 'multipart';
const FINISH = 'finish';
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

  var parser = new Parser(tempdir, req, next);
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
  busboy.once(FINISH, () => {
    parser.onceFinished();
  });

  req.pipe(busboy);
};
