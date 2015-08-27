# fi-seed-component-fileman
Fi Seed's Fileman component

## Installing

```
npm install --save fi-seed-component-fileman
```

## Usage
### Use on fi-seed

```js
var fileman = component('fileman');
```

### Use on Express/Node app

```js
var fileman = require('fi-seed-component-fileman');
```

### Initialization
This component musit be initialized before using it:

```js
var fileman = require('fi-seed-component-fileman');
var db = require('your-database-manager');
var app = require('express')();
var path = require('path');

fileman.init({
  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads'),
  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),
  debug: true
});

//...

app.use(fileman.multiparser);
app.use(fileman.cleaner);

//...

app.post('/api/files/', function (req, res, next) {

  var saved = [];

  req.files.forEach(function (file) {
    fileman.save(file, folder, function (err, fileinfo) {
      if (err) {
        return next(err);
      }

      // Save the file information (fileinfo) to a database entry or something alike...

      db.files.create(fileinfo, function (err, data) {
        if (err) {
          return next(err);
        }

        saved.push(data);

        if (saved.length === req.files.length) {
          res.send(saved);
        }
      });
    });
  });

});

app.get('/api/files/:id', function (req, res, next) {

  // Obtain the file information somehow...

  db.files.findById(req.params.id, function (err, data) {
    if (err) {
      return next(err);
    }

    res.download(fileman.resolve(data.path), data.name);
  });

});

//...
```

## Methods
Fileman exposes multiple methods that might be used as functions or Express middleware.

### Init
This is the initialization method and must be called before using any of it's methods or it will throw an error:

```js
fileman.init({

  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads'),

  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),

  debug: true

});
```

It only receives a parameter that must be an `Object` with the following optional parameters:
- **tempdir**: This can be a `String` to the absolute path where the temporal uploaded files are saved. It defaults to:
- path.join(os.tmpDir(), 'fileman-uploads')
- **stordir**: This can be a `String` to the absolute path where the files are finally stored. It defaults to:

  ```js
  path.join(process.env.HOME || process.env.USERPROFILE, 'fileman-storage')
  ```

  That path might resolve to `C:\Users\[your user]\fileman-storage` in Windows, to `/home/[your user]/fileman-storage` in Linux and to `/Users/[your user]/fileman-storage` in OSX.

- **debug**: This can be a `Function` to log with or a `Boolean`. If `true` it will use `console.log`.

If you wish to configure it with a module then it should look like this:

```js
'use strict';

var debug = require('debug');
var path = require('path');
var os = require('os');

module.exports = {

  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads'),

  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),

  debug: debug('app:fileman')

};
```

And then in your application, assuming it's located in `[app dir]/config/fileman.js` and you're calling it from a script located in `[app dir]/app.js`:

```js
fileman.init(require('./config/fileman'));
```

### Multiparser
Use this method as an _Express middelware_ that intercepts POST or PUT `multipart/form-data` requests only. This will save the uploaded temporal files to the specified `tempdir`, add the uploaded files to `req.files` as an `Array` and attach the fields to `req.body` as an object with field names as properties. The fields are parsed as JSON whenever possible.

```js
app.use(fileman.multiparser);
```

In the `next` callback you'll receive the parameters as usual but `req` will now have `body` and `files` properties as an `Object` and `Array` respectively:

```js
app.post('/api/files', function (req, res, next) {

  var saved = [];

  req.files.forEach(function (file) {
    fileman.save(file, folder, function (err, fileinfo) {
      if (err) {
        return next(err);
      }

      // Save the file information (fileinfo) to a database entry or something alike...

      db.files.create(fileinfo, function (err, data) {
        if (err) {
          return next(err);
        }

        saved.push(data);

        if (saved.length === req.files.length) {
          res.send(saved);
        }
      });
    });
  });

});
```

So if the user makes a `POST` with `multipart/form-data` to `/api/files`, like the example above, then the `req` object will contain the corresponding files and fields.

### Cleaner
This **Express middleware** will clean all the files inside the `req.files` `Array` once the `res` has finished so where you declare it is not really relevant.

```js
//...
app.use(fileman.cleaner);
//...
```

If you do not wish to remove the temporal uploaded files, just don't use this middleware.

### Save
Use this method to save a file to a path relative to the specified `stordir`. Useful for storing temporal uploaded files.

It must be called with three parameters:
- **fileinfo**: This is an `Object` containing the file's information, not the content, composed of the following properties:
  - **path**: This is required and must be a `String` with the full path pointing to the file to read.
  - **name**: An optional `String` with the file's name.

- **destpath**: This is an optional `String` pointing to a folder relative to the `stordir`. If not passed then it'll save the files directly in the `stordir`.

- **done**: A callback `Function` that will receive an `err` `Object`, `null` on success, and a `fileinfo` `Object`. The `fileinfo` `Object` has the following properties:
  - **name**: A `String` with the uploaded or original file's name or `null`.
  - **path**: A `String` with the file's path relative to the `stordir`.
  - **md5**: A `String` with the file's MD5 hash.
  - **encoding**: A `String` with the detected encoding.
  - **size**: A `Number` with the detected file's size in bytes.
  - **type**: A `String` with the detected mimetype.

```js
var file = {
  name: 'my-file.txt',
  path: '/full/path/to/the/file/my-file.txt'
};

var folder = '/folder/relative/to/stordir';

fileman.save(file, folder, function (err, fileinfo) {
  if (err) {
    return next(err);
  }

  // File has been saved successfully
});
```

The `fileinfo` `Object` will be like this:

```js
{
  name: String,
  path: String,
  md5: String,
  encoding: String,
  type: String,
  stats: Object
}
```

The `fileinfo.stats` `Object` is the result of a Node.js `fs.stat`, that looks like this:

```js
{
  dev: Number,
  mode: Number,
  nlink: Number,
  uid: Number,
  gid: Number,
  rdev: Number,
  blksize: Number,
  ino: Number,
  size: Number,
  blocks: Number,
  atime: Date,
  mtime: Date,
  ctime: Date,
  birthtime: Date
}
```

If you need to know more about `fs.stats` read the [Node.js documentation](https://nodejs.org/api/fs.html#fs_fs_stat_path_callback) and [System stats wiki](https://en.wikipedia.org/wiki/Stat_(system_call).

#### Important
All paths are normalized, meaning that if you pass `'..'` as the folder it will save the file into the `stordir`'s parent folder and so on.

### Read
Reads a file from it's path relative to the `stordir` folder and returns it's read `Stream`:

```js
app.get('/api/files/:id', function (req, res, end) {

  // Obtain the file information somehow...

  db.files.findById(req.params.id, function (err, data) {
    if (err) {
      return next(err);
    }

    fileman.read('/path/to/file.txt').pipe(res);
  });

});
```

If your previously saved the file information to some database or alike, then it's a good practice to set the response headers with the corresponding information before sending it:

```js
app.get('/api/files/:id', function (req, res, end) {

  // Obtain the file information somehow...

  db.files.findById(req.params.id, function (err, data) {
    if (err) {
      return next(err);
    }

    res.set({
      'Content-Disposition': 'inline; filename="' + data.name + '"',
      'Cache-Control': 'max-age=31536000',
      'Content-Length': data.stats.size,
      'Last-Modified': data.stats.mtime,
      'Content-Type': data.mimetype,
      'ETag': data.md5
    });

    fileman.read(data.path).pipe(res);
  });

});
```

#### Important
As you may have noticed, the `fileinfo` is retrieved from your database, meaning that if the files are modified, accessed or deleted outside the application then this information will be incorrect. Make sure you update your database entries accordingly.

### Resolve
This method is to obtain the file's full path relative to the `stordir` folder. This can be particularly useful when using Express' `res.download` method:

```js
app.get('/api/files/:id', function (req, res, end) {

  // Obtain the file information somehow...

  db.files.findById(req.params.id, function (err, data) {
    if (err) {
      return next(err);
    }

    res.download(fileman.resolve(data.path), data.name);
  });

});
```
