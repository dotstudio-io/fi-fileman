# fi-fileman
File manager and `multipart/form-data` parser for Node.js Express applications.

## Installing
```sh
npm install --save fi-fileman
```

## Usage
```js
var fileman = require('fi-fileman');
```

### Initialization
This component should be configured before using it:

```js
var fileman = require('fi-seed-component-fileman');
var db = require('your-database-manager');
var app = require('express')();
var path = require('path');

fileman.configure({
  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads'),
  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage')
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

      /* Save the file information (fileinfo) to a database entry or something alike... */
      db.model('files').create(fileinfo, function (err, data) {
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

  /* Obtain the file information somehow... */
  db.model('files').findById(req.params.id, function (err, data) {
    if (err) {
      return next(err);
    }

    /* Send the data to the user */
    res.download(fileman.resolve(data.path), data.name);
  });

});

//...
```

## Methods
**Fi Fileman** exposes multiple methods that might be used as functions or as an Express middleware.

### Configure
This method should be called before using any other **Fi Fileman**'s methods:

```js
fileman.configure({

  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),

  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads')

});
```

It only receives a parameter that must be an `Object` with the following optional parameters:
- **tempdir**: This can be a `String` to the absolute path where the temporal uploaded files are saved. It defaults to:

  ```js
  path.join(os.tmpDir(), 'fileman-uploads')
  ```

- **stordir**: This can be a `String` to the absolute path where the files are finally stored. It defaults to:

  ```js
  path.join(process.env.HOME || process.env.USERPROFILE, 'fileman-storage')
  ```

  That path might resolve to `C:\Users\<USER>\fileman-storage` in Windows, to `/home/<USER>/fileman-storage` in Linux and to `/Users/<USER>/fileman-storage` in OSX.

#### Using a configuration module
If you wish to configure it with a module then it should look like this:

```js
'use strict';

var path = require('path');
var os = require('os');

module.exports = {

  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),

  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads')

};
```

And then in your application, assuming it's located in `<APP_DIR>/config/fileman.js` and you're calling it from a script located in `<APP_DIR>/app.js`:

```js
fileman.init(require('./config/fileman'));
```

### Multiparser
This method returns an *Express middelware* that intercepts POST or PUT `multipart/form-data` requests only. This will save the uploaded temporal files to the specified `tempdir` and will add the `fileinfo` objects to `req.files` as an `Array`, even if just one file was uploaded, and attach the parsed form data fields to `req.body` as an object with field names as properties. The fields are parsed as JSON whenever possible.

```js
app.use(fileman.multiparser());
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

      /* Save the file information (fileinfo) to a database entry or something alike... */
      db.model('files').create(fileinfo, function (err, data) {
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

So if the user makes a `POST` with `multipart/form-data` to `/api/files`, like the example above, then the `req` object will contain the corresponding `fileinfo` `Array` in `req.files` and fields `Object` in `req.body`.

### Cleaner
This method returns an *Express middleware* that will clean all the files inside the `req.files` `Array` once the `res` has finished so where you declare it is not really relevant.

```js
//...
app.use(fileman.cleaner());
//...
```

If you do not wish to remove the temporal uploaded files after the request has finished then just don't use this middleware.

### Save
Use this method to save a file to a path relative to the configured `stordir`. Useful for storing temporal uploaded files into it's definitive location.

It must be called with three parameters:
- **fileinfo**: This is an `Object` containing the file's information, not the binary content, composed of the following properties:
  - **path**: This is required and must be a `String` with the full path pointing to the file to read.
  - **name**: An optional `String` with the file's original name.

- **destpath**: This is an optional `String` pointing to a folder relative to the `stordir`. If not passed then it'll save the files directly in the `stordir`.
- **done**: A callback `Function` that will receive an `err` `Object`, `null` on success, and a `fileinfo` `Object`.

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

  /* File has been saved successfully */
});
```

#### Important
All paths are normalized, meaning that if you pass `'..'` as the folder it will save the file into the `stordir`'s parent folder and so on.

### Read
Reads a file from it's path relative to the `stordir` folder and returns it's read `Stream`:

```js
app.get('/api/files/:id', function (req, res, end) {

  // Obtain the file information somehow...

  db.files.findById(req.params.id, function (err, fileinfo) {
    if (err) {
      return next(err);
    }

    fileman.read(fileinfo.path).pipe(res);
  });

});
```

It's a good practice to set the correct and recommended response headers with the corresponding information before sending it:

```js
app.get('/api/files/:id', function (req, res, end) {

  /* Obtain the file information somehow... */
  db.model('files').findById(req.params.id, function (err, fileinfo) {
    if (err) {
      return next(err);
    }

    res.set({
      'Content-Disposition': 'inline; filename="' + fileinfo.name + '"',
      'Cache-Control': 'max-age=31536000',
      'Content-Length': fileinfo.stats.size,
      'Last-Modified': fileinfo.stats.mtime,
      'Content-Type': fileinfo.mimetype,
      'ETag': fileinfo.md5
    });

    /* Pipe the read content into the response */
    fileman.read(fileinfo.path).pipe(res);
  });

});
```

#### Important
As you may have noticed, the `fileinfo` is retrieved from your database, meaning that if the files are modified, accessed or deleted outside the application then this information will be incorrect. Make sure you update your database entries accordingly.

### Resolve
Use this method is to obtain the file's full path relative to the `stordir` folder. This can be particularly useful when using Express' `res.download` method:

```js
app.get('/api/files/:id', function (req, res, end) {

  /* Obtain the file information somehow... */
  db.model('files').findById(req.params.id, function (err, fileinfo) {
    if (err) {
      return next(err);
    }

    res.download(fileman.resolve(fileinfo), fileinfo.name);
  });

});
```

It receives only one argument that can be a `String` with the relative path to the `stordir` or a `fileinfo` `Object` with a valid `path` value.

### Fileinfo Object
The `fileinfo` `Object` has the following properties:

  - **name**: A `String` with the original file's name or `null`.
  - **path**: A `String` with the file's path relative to the `stordir`.
  - **md5**: A `String` with the file's MD5 hash.
  - **encoding**: A `String` with the detected encoding.
  - **type**: A `String` with the detected mimetype.
  - **stats**: An `Object` with the results of Node's `fs.stats` on the file.

The `fileinfo` `Object` structure:
```js
{
  name: String,
  path: String,
  md5: String,
  encoding: String,
  type: String,
  stats: {
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
}
```

The `fileinfo.stats` `Object` is the result of a Node.js's `fs.stat` on the file.

If you need to know more about `fs.stats` read the [Node.js documentation](https://nodejs.org/api/fs.html#fs_fs_stat_path_callback) and [System stats wiki](https://en.wikipedia.org/wiki/Stat_(system_call).
