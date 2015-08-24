'use strict';

var bodyParser = require('body-parser');
var expect = require('chai').expect;
var mongoose = require('mongoose');
var request = require('request');
var express = require('express');
var fileman = require('..');
var path = require('path');
var fs = require('fs');

var config = require('./config');

var uploaded = [];

var host;

describe('Fi Seed Fileman', function () {
  before(function (done) {
    var app = express();

    fileman.configure(config);

    app.use(bodyParser.json());

    app.use(bodyParser.urlencoded({
      extended: false
    }));

    app.use(fileman.multiparser);

    app.use(fileman.uploadedFilesCleaner);

    app.get('/', function (req, res, next) {
      res.end();
    });

    function upload(req, res, next) {
      var saved = [];

      req.files.forEach(function (file) {
        fileman.save(file, 'saved', function (err, filedata) {
          if (err) {
            res.status(500).send(err);
          }

          saved.push(filedata);

          if (saved.length === req.files.length) {
            res.send(saved);
          }
        });
      });
    }

    app.post('/', upload);
    app.put('/', upload);

    app.get('/file/:path', function () {

    });

    var server = app.listen(function () {
      console.log('Server listening on port', server.address().port, '\n');
      host = 'http://localhost:' + server.address().port;
      done();
    });
  });

  describe('server', function () {
    it('should respond a GET to / with a 200 status code', function (done) {
      request.get(host, function (err, response) {
        expect(err).to.be.null;
        expect(response.statusCode).to.equal(200);

        done();
      });
    });
  });

  describe('component', function () {
    it('should be a object', function () {
      expect(fileman).to.be.an('object');
    });

    it('should parse multipart-form data via POST', function (done) {
      request.post({
        url: host,

        formData: {
          file: fs.createReadStream(path.join(__dirname, 'fixtures', 'text.txt'))
        }
      }, function (err, response, body) {
        var parsed = JSON.parse(body);

        expect(err).to.be.null;
        expect(parsed).to.be.an('array');

        expect(parsed[0].name).to.be.a('string');
        expect(parsed[0].type).to.be.a('string');
        expect(parsed[0].size).to.be.a('number');
        expect(parsed[0].path).to.be.a('string');
        expect(parsed[0].md5).to.be.a('string');

        uploaded.concat(parsed);

        done();
      });
    });

    it('should parse multipart-form data via PUT', function (done) {
      request.put({
        url: host,

        formData: {
          file: fs.createReadStream(path.join(__dirname, 'fixtures', 'image.png'))
        }
      }, function (err, response, body) {
        var parsed = JSON.parse(body);

        expect(err).to.be.null;
        expect(parsed).to.be.an('array');

        expect(parsed[0].name).to.be.a('string');
        expect(parsed[0].type).to.be.a('string');
        expect(parsed[0].size).to.be.a('number');
        expect(parsed[0].path).to.be.a('string');
        expect(parsed[0].md5).to.be.a('string');

        uploaded.concat(parsed);

        done();
      });
    });
  });

  after(function () {});
});
