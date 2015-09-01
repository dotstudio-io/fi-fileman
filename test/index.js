'use strict';

var bodyParser = require('body-parser');
var expect = require('chai').expect;
var mmmagic = require('mmmagic');
var request = require('request');
var express = require('express');
var crypto = require('crypto');
var fs = require('fs-extra');
var path = require('path');
var util = require('util');
var walk = require('walk');
var os = require('os');

var config = require('./config');
var fileman = require('..');

var downloads = path.normalize(path.join(__dirname, 'downloads'));
var logfile = path.join(__dirname, 'tests.log');
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

  it('should use default values if not configured', function () {
    expect(fileman.defaults.stordir).to.be.a('string');
    expect(fileman.defaults.tempdir).to.be.a('string');

    expect(fileman.config.stordir).to.be.empty;
    expect(fileman.config.tempdir).to.be.empty;
  });

  it('should configure successfully', function () {
    fileman.configure(config);

    expect(fileman.config.stordir).to.equal(config.stordir);
    expect(fileman.config.tempdir).to.equal(config.tempdir);
  });

  it('should be kept initialized', function () {
    expect(require('..').config.stordir).to.equal(config.stordir);
    expect(require('..').config.tempdir).to.equal(config.tempdir);
  });

});

describe('Fi Seed Fileman HTTP', function () {

  before(function (done) {
    fs.removeSync(logfile);

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

      app.use(bodyParser.json());

      app.use(bodyParser.urlencoded({
        extended: false
      }));

      app.use(fileman.multiparser());
      app.use(fileman.cleaner());

      app.get('/', function (req, res, next) {
        res.end();
      });

      function upload(req, res, next) {
        var saved = [];

        if (!req.files.length) {
          return res.send(saved);
        }

        req.files.forEach(function (file) {
          fileman.save(file, 'with-post', function (err, fileinfo) {
            if (err) {
              return next(err);
            }

            saved.push(fileinfo);

            if (saved.length === req.files.length) {
              res.send(saved);
            }
          });
        });
      }

      app.post('/', upload);
      app.put('/', upload);

      app.get('/file', function (req, res, next) {
        if (!req.query.path) {
          return res.status(400).end();
        }

        var resolved = fileman.resolve(req.query.path);

        fs.exists(resolved, function (exists) {
          if (!exists) {
            return res.status(404).end();
          }

          fs.stat(resolved, function (err, stats) {
            if (err) {
              throw err;
            }

            var magic = new mmmagic.Magic(mmmagic.MAGIC_MIME_TYPE);

            magic.detectFile(resolved, function (err, mimetype) {
              if (err) {
                return next(err);
              }

              var hash = crypto.createHash('md5');
              var rs = fileman.read(req.query.path);

              rs.on('data', function (data) {
                hash.update(data, 'utf8');
              });

              rs.on('error', function (err) {
                next(err);
              });

              rs.on('end', function () {
                res.set({
                  'Content-Disposition': 'inline; filename="' + path.basename(req.query.path) + '"',
                  'Cache-Control': 'max-age=31536000',
                  'Content-Length': stats.size,
                  'Last-Modified': stats.mtime,
                  'Content-Type': mimetype,
                  'ETag': hash.digest('hex')
                });

                fileman.read(req.query.path).pipe(res);
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
        console.log('\nServer listening on port', server.address().port, '\n');
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

    it('should processes a multipart form data without files', function (done) {
      request.post({
        url: host,

        formData: {
          werwer: 'werwerwer'
        }
      }, function (err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(0);

        done();
      });
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
        expect(files[0].stats.size).to.be.a('number');
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
        expect(files[0].stats.size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored = stored.concat(files);

        done();
      });
    });

    it('should be able to process parallel requests', function (done) {
      var completed = 0;
      var total = 20;

      function onresponse(err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(1);

        expect(files[0].name).to.be.a('string');
        expect(files[0].type).to.be.a('string');
        expect(files[0].stats.size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored = stored.concat(files);

        if (++completed === total) {
          done();
        }
      }

      for (var i = 0; i < total; i++) {
        request.post(getdata(), onresponse);
      }
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
          expect(file.stats.size).to.be.a('number');
          expect(file.path).to.be.a('string');
          expect(file.md5).to.be.a('string');
        });

        stored = stored.concat(files);

        done();
      });
    });

    it('should be able to save multiple uploaded files on parallel requests', function (done) {
      var completed = 0;
      var total = 20;

      function onresponse(err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(4);

        files.forEach(function (file) {
          expect(file.name).to.be.a('string');
          expect(file.type).to.be.a('string');
          expect(file.stats.size).to.be.a('number');
          expect(file.path).to.be.a('string');
          expect(file.md5).to.be.a('string');
        });

        stored = stored.concat(files);

        if (++completed === total) {
          done();
        }
      }

      for (var i = 0; i < total; i++) {
        request.post({
          url: host,

          formData: {
            uploads: [
              fs.createReadStream(getfile()),
              fs.createReadStream(getfile()),
              fs.createReadStream(getfile()),
              fs.createReadStream(getfile())
            ]
          }
        }, onresponse);
      }
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

            expect(stats.size).to.equal(file.stats.size);

            done();
          });
        });
      });

      request(host + '/file?path=' + file.path).

      on('response', function (res) {
        expect(res.statusCode).to.equal(200);
        expect(Number(res.headers['content-length'])).to.equal(file.stats.size);
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
