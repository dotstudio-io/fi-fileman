'use strict';

var bodyParser = require('body-parser');
var expect = require('chai').expect;
var mmmagic = require('mmmagic');
var request = require('request');
var express = require('express');
var crypto = require('crypto');
var fs = require('fs-extra');
var path = require('path');
var walk = require('walk');

var config = require('./config');
var fileman = require('..');

var storedlist = path.normalize(path.join(__dirname, 'storedlist.log'));
var downloads = path.normalize(path.join(__dirname, 'downloads'));
var fixtures = [];
var stored = [];

var host;

function getfile() {
  return fixtures.sort(function () {
    return 0.5 - Math.random();
  })[0];
}

function getdata() {
  return {
    url: host,

    formData: {
      upload: fs.createReadStream(getfile())
    }
  };
}

describe('Fi Seed Fileman', function () {

  before(function (done) {
    fs.removeSync(path.join(__dirname, 'fileman.log'));
    fs.removeSync(path.join(__dirname, 'storedlist.log'));

    var walker = walk.walk(path.join(__dirname, 'fixtures'));

    walker.on('file', function (root, stats, next) {
      fixtures.push(path.join(root, stats.name));
      next();
    });

    walker.on('errors', function (err) {
      throw err;
    });

    walker.on('end', function () {
      var app = express();

      fileman.configure(config);

      app.use(bodyParser.json());
      app.use(bodyParser.urlencoded({
        extended: false
      }));

      app.use(fileman.multiparser);
      app.use(fileman.cleaner);

      app.get('/', function (req, res, next) {
        res.end();
      });

      function upload(req, res, next) {
        var saved = [];

        req.files.forEach(function (file) {
          fileman.save(file, 'with-post', function (err, filedata) {
            if (err) {
              return next(err);
            }

            saved.push(filedata);

            fs.appendFile(storedlist, '\n' + JSON.stringify(filedata, null, 2) + '\n', function (err, data) {
              if (err) {
                throw err;
              }
            });

            if (saved.length === req.files.length) {
              res.send(saved);
            }
          });
        });
      }

      app.post('/', upload);
      app.put('/', upload);

      app.get('/file', function (req, res, next) {
        if (!req.query.path && !req.params.path) {
          return res.status(400).end();
        }

        var querypath = req.query.path || req.params.path;
        var resolved = fileman.resolve(querypath);

        fs.exists(resolved, function (exists) {
          if (!exists) {
            return res.status(404).end();
          }

          fs.stat(resolved, function (err, stats) {
            if (err) {
              return next(err);
            }

            var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);

            magic.detectFile(resolved, function (err, mimetype) {
              if (err) {
                return next(err);
              }

              var hash = crypto.createHash('md5');
              var rs = fileman.read(querypath);

              rs.on('data', function (data) {
                hash.update(data, 'utf8');
              });

              rs.on('error', function (err) {
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

                fileman.read(querypath).pipe(res);
              });

            });
          });
        });
      });

      app.use(function (req, res, next) {
        res.status(404);
        next();
      });

      app.use(function (err, req, res, next) {
        if (res.status === 404) {
          return res.end();
        }

        throw err;
      });

      var server = app.listen(function () {
        console.log('Server listening on port', server.address().port, '\n');
        host = 'http://localhost:' + server.address().port;
        done();
      });

    });
  });

  describe('server', function () {
    it('should respond a GET to / with a 200 status code', function (done) {
      request.get(host, function (err, res) {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);

        done();
      });
    });
  });

  describe('component', function () {
    it('should be a object', function () {
      expect(fileman).to.be.an('object');
    });

    it('should parse and save multipart-form data via POST', function (done) {
      request.post(getdata(), function (err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(1);

        expect(files[0].name).to.be.a('string');
        expect(files[0].type).to.be.a('string');
        expect(files[0].size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored = stored.concat(files);

        done();
      });
    });

    it('should parse and save multipart-form data via PUT', function (done) {
      request.put(getdata(), function (err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(1);

        expect(files[0].name).to.be.a('string');
        expect(files[0].type).to.be.a('string');
        expect(files[0].size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored = stored.concat(files);

        done();
      });
    });

    it('should be able to process parallel requests', function (done) {
      var completed = 0;

      function onresponse(err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(1);

        expect(files[0].name).to.be.a('string');
        expect(files[0].type).to.be.a('string');
        expect(files[0].size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored = stored.concat(files);

        if (++completed === 5) {
          done();
        }
      }

      request.post(getdata(), onresponse);
      request.post(getdata(), onresponse);
      request.post(getdata(), onresponse);
      request.post(getdata(), onresponse);
      request.post(getdata(), onresponse);
    });

    it('should be able to save multiple uploaded files', function (done) {
      request.put({
        url: host,

        formData: {
          uploads: [
            fs.createReadStream(getfile()),
            fs.createReadStream(getfile()),
            fs.createReadStream(getfile()),
            fs.createReadStream(getfile())
          ]
        }
      }, function (err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(4);

        files.forEach(function (file) {
          expect(file.name).to.be.a('string');
          expect(file.type).to.be.a('string');
          expect(file.size).to.be.a('number');
          expect(file.path).to.be.a('string');
          expect(file.md5).to.be.a('string');
        });

        stored = stored.concat(files);

        done();
      });
    });

    it('should download a file from it\'s path', function (done) {
      var file = stored.sort(function () {
        return 0.5 - Math.random();
      })[0];

      var filepath = path.normalize(path.join(downloads, path.basename(file.path)));
      var ws = fs.createOutputStream(filepath);

      ws.on('error', function (err) {
        throw err;
      });

      ws.on('finish', function () {
        ws.close(function () {
          fs.stat(filepath, function (err, stats) {
            if (err) {
              throw err;
            }

            expect(stats.size).to.equal(file.size);

            done();
          });
        });
      });

      request(host + '/file?path=' + file.path).

      on('response', function (res) {
        expect(res.statusCode).to.equal(200);
        expect(Number(res.headers['content-length'])).to.equal(file.size);
        expect(res.headers.etag).to.equal(file.md5);
      }).

      on('error', function (err) {
        throw err;
      }).

      pipe(ws);
    });

    after(function () {
      fs.removeSync(config.stordir);
      fs.removeSync(config.tempdir);
      fs.removeSync(downloads);
    });
  });


});
