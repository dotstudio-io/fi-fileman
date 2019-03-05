'use strict';

const md5File = require('md5-file/promise');
const bodyParser = require('body-parser');
const expect = require('chai').expect;
const request = require('request');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const walk = require('walk');

const config = require('./config');
const fileman = require('..').anew();

const downloads = path.normalize(path.join(__dirname, 'downloads'));
const logfile = path.join(__dirname, 'tests.log');
const fixtures = [];

var stored = [];
var host;

function getfile() {
  return fixtures.sort(() => {
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

describe('Fi Fileman (Promised)', function() {
  it('should use default values if not configured', function() {
    expect(fileman.defaults.stordir).to.be.a('string');
    expect(fileman.defaults.tempdir).to.be.a('string');

    expect(fileman.config.stordir).to.be.undefined;
    expect(fileman.config.tempdir).to.be.undefined;
  });

  it('should configure successfully', function() {
    fileman.configure(config);

    expect(fileman.config.stordir).to.equal(config.stordir);
    expect(fileman.config.tempdir).to.equal(config.tempdir);
  });
});

describe('Fi Fileman HTTP (Promised)', function() {
  let server;

  before(function(done) {
    fs.removeSync(logfile);

    var walker = walk.walk(path.join(__dirname, 'fixtures'));

    walker.on('file', (root, stats, next) => {
      fixtures.push(path.join(root, stats.name));
      next();
    });

    walker.on('errors', err => {
      throw err;
    });

    walker.on('end', () => {
      var app = express();

      app.use(bodyParser.json());

      app.use(
        bodyParser.urlencoded({
          extended: false
        })
      );

      app.use(fileman.multiparser());
      app.use(fileman.cleaner());

      app.get('/', (req, res, next) => res.end()); // eslint-disable-line

      function upload(req, res, next) {
        var saved = [];

        if (!req.files.length) {
          return res.send(saved);
        }

        req.files.forEach(file => {
          fileman
            .save(file, 'with-post')
            .then(fileinfo => {
              saved.push(fileinfo);

              if (saved.length === req.files.length) {
                res.send(saved);
              }
            })
            .catch(next);
        });
      }

      app.post('/', upload);
      app.put('/', upload);

      app.get('/file', (req, res, next) => {
        if (!req.query.path) {
          return res.status(400).end();
        }

        var resolved = fileman.resolve(req.query.path);

        fs.exists(resolved)
          .then(exists => {
            if (!exists) {
              return res.status(404).end();
            }

            return fs.stat(resolved);
          })
          .then(stats => {
            return md5File(resolved).then(hash => {
              res.set({
                'Content-Disposition': 'inline; filename="' + path.basename(req.query.path) + '"',
                'Cache-Control': 'max-age=31536000',
                'Content-Length': stats.size,
                'Last-Modified': stats.mtime,
                // 'Content-Type': mimetype,
                ETag: hash
              });

              fileman.read(req.query.path).pipe(res);
            });
          })
          .catch(next);
      });

      app.use((req, res, next) => {
        res.status(404);
        next();
      });

      app.use((err, req, res, next) => {
        // eslint-disable-line
        if (res.status === 404) {
          return res.end();
        }

        throw err;
      });

      server = app.listen(() => {
        host = 'http://localhost:' + server.address().port;
        done();
      });
    });
  });

  describe('server', function() {
    it('should respond a GET to / with a 200 status code', function(done) {
      request.get(host, function(err, res) {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);

        done();
      });
    });
  });

  describe('component', function() {
    it('should be a object', function() {
      expect(fileman).to.be.an('object');
    });

    it('should processes a multipart form data without files', function(done) {
      request.post(
        {
          url: host,

          formData: {
            werwer: 'werwerwer'
          }
        },
        function(err, res, body) {
          var files = JSON.parse(body);

          expect(err).to.be.null;
          expect(res.statusCode).to.equal(200);
          expect(files).to.be.an('array');
          expect(files.length).to.equal(0);

          done();
        }
      );
    });

    it('should parse and save multipart-form data via POST', function(done) {
      request.post(getdata(), function(err, res, body) {
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

    it('should parse and save multipart-form data via PUT', function(done) {
      request.put(getdata(), function(err, res, body) {
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

    it('should be able to process parallel requests', function(done) {
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

    it('should be able to save multiple uploaded files', function(done) {
      request.put(
        {
          url: host,

          formData: {
            uploads: [
              fs.createReadStream(getfile()),
              fs.createReadStream(getfile()),
              fs.createReadStream(getfile()),
              fs.createReadStream(getfile())
            ]
          }
        },
        function(err, res, body) {
          var files = JSON.parse(body);

          expect(err).to.be.null;
          expect(res.statusCode).to.equal(200);
          expect(files).to.be.an('array');
          expect(files.length).to.equal(4);

          files.forEach(function(file) {
            expect(file.name).to.be.a('string');
            expect(file.type).to.be.a('string');
            expect(file.stats.size).to.be.a('number');
            expect(file.path).to.be.a('string');
            expect(file.md5).to.be.a('string');
          });

          stored = stored.concat(files);

          done();
        }
      );
    });

    it('should be able to save multiple uploaded files on parallel requests', function(done) {
      var completed = 0;
      var total = 20;

      function onresponse(err, res, body) {
        var files = JSON.parse(body);

        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(files).to.be.an('array');
        expect(files.length).to.equal(4);

        files.forEach(function(file) {
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
        request.post(
          {
            url: host,

            formData: {
              uploads: [
                fs.createReadStream(getfile()),
                fs.createReadStream(getfile()),
                fs.createReadStream(getfile()),
                fs.createReadStream(getfile())
              ]
            }
          },
          onresponse
        );
      }
    });

    it("should download a file from it's path", function(done) {
      var file = stored.sort(function() {
        return 0.5 - Math.random();
      })[0];

      var filepath = path.normalize(path.join(downloads, path.basename(file.path)));
      fs.ensureDir(path.dirname(filepath)).then(() => {
        var ws = fs.createWriteStream(filepath);

        ws.once('error', done);

        ws.once('finish', function() {
          ws.close(function() {
            fs.stat(filepath, function(err, stats) {
              if (err) {
                throw err;
              }

              expect(stats.size).to.equal(file.stats.size);

              done();
            });
          });
        });

        request(host + '/file?path=' + file.path)
          .once('response', function(res) {
            expect(res.statusCode).to.equal(200);
            expect(Number(res.headers['content-length'])).to.equal(file.stats.size);
            expect(res.headers.etag).to.equal(file.md5);
          })
          .once('error', done)
          .pipe(ws);
      });
    });

    after(function() {
      fs.removeSync(config.stordir);
      fs.removeSync(config.tempdir);
      fs.removeSync(downloads);
      server.close();
    });
  });
});
