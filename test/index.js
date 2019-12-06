const request = require('request-promise-native');
const md5File = require('md5-file/promise');
const bodyParser = require('body-parser');
const expect = require('chai').expect;
const express = require('express');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const mime = require('mime');

const config = require('./config');
const fileman = require('..').anew();

const downloads = path.normalize(path.join(__dirname, 'downloads'));
const logfile = path.join(__dirname, 'tests.log');
const fixtures = [];

const stored = [];

let host;

function getfile () {
  return fixtures.sort(() => 0.5 - Math.random())[0];
}

function getFiles (count) {
  const files = [];

  for (let i = 0; i < count; i++) {
    const file = getfile();

    files.push({
      value: fs.createReadStream(file),
      options: {
        contentType: mime.getType(file),
        filename: path.basename(file)
      }
    });
  }

  return files;
}

function getdata () {
  return {
    url: host,

    formData: {
      upload: fs.createReadStream(getfile())
    }
  };
}

/**
 * Upload middleware function.
 */
async function upload (req, res, next) {
  const saved = [];

  if (!req.files.length) {
    return res.send(saved);
  }

  for (const file of req.files) {
    try {
      const fileinfo = await fileman.save(file, 'with-post');
      saved.push(fileinfo);
    } catch (err) {
      return next(err);
    }
  }

  res.send(saved);
}

describe('Fi Fileman', function () {
  it('should be a object', () => {
    expect(fileman).to.be.an('object');
  });

  it('should use default values if not configured', function () {
    expect(fileman.defaults.stordir).to.be.a('string');
    expect(fileman.defaults.tempdir).to.be.a('string');

    expect(fileman.config.stordir).to.be.undefined;
    expect(fileman.config.tempdir).to.be.undefined;
  });

  it('should configure successfully', function () {
    fileman.configure(config);

    expect(fileman.config.stordir).to.equal(config.stordir);
    expect(fileman.config.tempdir).to.equal(config.tempdir);
  });

  describe('HTTP', function () {
    let server;

    before(async function () {
      await fs.remove(logfile);

      const root = path.join(__dirname, 'fixtures', '*.*');
      const files = glob.sync(root);

      for (const file of files) {
        fixtures.push(file);
      }

      const app = express();

      app.use(bodyParser.json());
      app.use(bodyParser.urlencoded({
        extended: false
      }));

      app.use(fileman.multiparser());
      app.use(fileman.cleaner());

      app.get('/', (req, res, next) => res.end()); // eslint-disable-line

      app.post('/', upload);
      app.put('/', upload);

      app.get('/file', async (req, res, next) => {
        if (!req.query.path) {
          return res.status(400).end();
        }

        try {
          const resolved = fileman.resolve(req.query.path);
          const exists = await fs.exists(resolved);

          if (!exists) {
            return res.status(404).end();
          }

          const stats = await fs.stat(resolved);
          const hash = await md5File(resolved);

          res.set({
            'Content-Disposition': `inline; filename="${path.basename(req.query.path)}"`,
            'Content-Type': mime.getType(stats.name),
            'Cache-Control': 'max-age=31536000',
            'Content-Length': stats.size,
            'Last-Modified': stats.mtime,
            'ETag': hash
          });

          fileman.read(req.query.path).pipe(res);
        } catch (err) {
          next(err);
        }
      });

      app.use((req, res, next) => {
        res.status(404);
        next();
      });

      app.use((err, req, res, next) => { // eslint-disable-line
        if (res.status === 404) {
          return res.end();
        }

        console.error(err.message);

        res.status(500).end();
      });

      await new Promise((resolve, reject) => {
        server = app.listen(0, err => {
          if (err) {
            reject(err);
            return;
          }

          host = `http://localhost:${server.address().port}`;

          console.info(`\nTest server listening on "${host}"\n`);

          resolve();
        });
      });
    });

    describe('test server', function () {
      it('should respond a GET to / with a 200 status code', async () => {
        const res = await request.get(host);
        expect(res).to.be.a('string');
      });
    });

    describe('component', function () {
      it('should processes a multipart form data without files', async () => {
        const res = await request.post({
          url: host,
          formData: {
            werwer: 'werwerwer'
          }
        });

        expect(res).to.be.a('string');

        const files = JSON.parse(res);

        expect(files).to.be.an('array');
        expect(files.length).to.equal(0);
      });

      it('should parse and save multipart-form data via POST', async () => {
        const res = await request.post(getdata());

        expect(res).to.be.a('string');

        const files = JSON.parse(res);

        expect(files).to.be.an('array');
        expect(files.length).to.equal(1);

        expect(files[0].name).to.be.a('string');
        expect(files[0].type).to.be.a('string');
        expect(files[0].stats.size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored.push(...files);
      });

      it('should parse and save multipart-form data via PUT', async () => {
        const res = await request.put(getdata());

        expect(res).to.be.a('string');

        const files = JSON.parse(res);

        expect(files).to.be.an('array');
        expect(files.length).to.equal(1);

        expect(files[0].name).to.be.a('string');
        expect(files[0].type).to.be.a('string');
        expect(files[0].stats.size).to.be.a('number');
        expect(files[0].path).to.be.a('string');
        expect(files[0].md5).to.be.a('string');

        stored.push(...files);
      });

      it('should be able to process parallel requests', async () => {
        for (let i = 0, l = 20; i < l; i++) {
          const res = await request.post(getdata());

          expect(res).to.be.a('string');

          const files = JSON.parse(res);

          expect(files).to.be.an('array');
          expect(files.length).to.equal(1);

          expect(files[0].name).to.be.a('string');
          expect(files[0].type).to.be.a('string');
          expect(files[0].stats.size).to.be.a('number');
          expect(files[0].path).to.be.a('string');
          expect(files[0].md5).to.be.a('string');

          stored.push(...files);
        }
      });

      it('should be able to save multiple uploaded files', async () => {
        const count = 4;
        const res = await request.put({
          url: host,
          formData: {
            uploads: getFiles(count)
          }
        });

        expect(res).to.be.a('string');

        const files = JSON.parse(res);

        expect(files).to.be.an('array');
        expect(files.length).to.equal(count);

        for (const file of files) {
          expect(file.name).to.be.a('string');
          expect(file.type).to.be.a('string');
          expect(file.stats.size).to.be.a('number');
          expect(file.path).to.be.a('string');
          expect(file.md5).to.be.a('string');
        }

        stored.push(...files);
      });

      it('should be able to save multiple uploaded files on parallel requests', async () => {
        const promises = [];
        const count = 4;

        for (var i = 0, l = 20; i < l; i++) {
          const promise = request.post({
            url: host,
            formData: {
              uploads: getFiles(count)
            }
          });

          promises.push(promise);
        }

        const responses = await Promise.all(promises);

        for (const res of responses) {
          expect(res).to.be.a('string');

          const files = JSON.parse(res);

          expect(files).to.be.an('array');
          expect(files.length).to.equal(count);

          for (const file of files) {
            expect(file.name).to.be.a('string');
            expect(file.type).to.be.a('string');
            expect(file.stats.size).to.be.a('number');
            expect(file.path).to.be.a('string');
            expect(file.md5).to.be.a('string');
          }

          stored.push(...files);
        }
      });

      it('should download a file from it\'s path', async () => {
        const file = stored.sort(() => 0.5 - Math.random())[0];
        const filepath = path.normalize(path.join(downloads, path.basename(file.path)));

        await fs.ensureDir(path.dirname(filepath));

        const ws = fs.createWriteStream(filepath);

        const res = await new Promise((resolve, reject) => {
          let res;

          ws.once('error', reject);

          ws.once('finish', () => {
            ws.close(async () => {
              const stats = await fs.stat(filepath);
              expect(stats.size).to.equal(file.stats.size);
              resolve(res);
            });
          });

          request(host + '/file?path=' + file.path)
            .once('response', r => (res = r))
            .once('error', reject)
            .pipe(ws);
        });

        expect(res.statusCode).to.equal(200);
        expect(parseInt(res.headers['content-length'])).to.equal(file.stats.size);
        expect(res.headers.etag).to.equal(file.md5);
      });
    });

    after(async function () {
      await new Promise(resolve => server.close(resolve));
      await fs.remove(config.stordir);
      await fs.remove(config.tempdir);
      await fs.remove(downloads);
    });
  });
});
