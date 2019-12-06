const Parser = require('./parser');
const Busboy = require('busboy');

/**
 * Parses any incoming multipart form data via POST or PUT.
 *
 * @type Express Middleware
 */
module.exports = tempdir => (req, res, next) => {
  /* Parse only POST and PUT request with multipart form data */
  if ((req.method !== 'POST' && req.method !== 'PUT') || !req.is('multipart')) {
    return next();
  }

  req.files = [];
  req.body = {};

  const parser = new Parser(tempdir);
  const busboy = new Busboy({
    headers: req.headers
  });

  /* Move uploaded files to the temp dir */
  busboy.on('file', (...args) => parser.onFile(...args));

  /* Append fields to the request body */
  busboy.on('field', (...args) => parser.onField(...args));

  /* Busboy has finished */
  busboy.on('finish', () => {
    parser.onFinish();
  });

  parser.on('file', data => {
    req.files.push(data);
  });

  parser.on('field', (field, value) => {
    req.body[field] = value;
  });

  parser.on('complete', () => {
    const complete = Object.keys(req.body).length === parser.fields &&
      req.files.length === parser.files &&
      parser.finished;

    if (complete) {
      next();
    }
  });

  parser.on('error', next);

  return req.pipe(busboy);
};
