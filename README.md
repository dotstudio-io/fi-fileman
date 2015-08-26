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
This component can be configured before using it:

```js
var fileman = require('fi-seed-component-fileman');
var app = require('express')();
var path = require('path');

fileman.configure({

  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads'),

  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),

  debug: true

});

//...

app.use(fileman.multiparser);
app.use(fileman.cleaner);

//...

app.post('/api/files/', fileman.uploader('stuff'));
app.get('/api/files/', fileman.downloader);

//...
```
## Usage
Fileman exposes multiple methods that might be used as functions or Express middleware.

### Configure
This is the configuration method. Must be called before anything if you wish to set different paths for your uploaded temporal files and stored files.

```js
fileman.configure({

  tempdir: path.join(os.tmpDir(), 'my-app', 'uploads'),

  stordir: path.join(process.env.HOME || process.env.USERPROFILE, 'my-app', 'storage'),

  debug: true

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
  That path might resolve to `C:\Users\[your user]\fileman-storage` in Windows, to `/home/[your user]/fileman-storage` in Linux and to `/Users/[your user]/fileman-storage` in OSX.

- **debug**: This can be a `Function` to log with or a `Boolean`. If `true` it will use `console.log`.

A configuration module should look like this:
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

### Multiparser
Use this method as an *Express middelware* that intercepts POST or PUT `multipart/form-data` requests only. This will save the uploaded temporal files to the specified `tempdir`, add the uploaded files to `req.files` as an `Array` and attach the fields to `req.body` as an object with field names as properties. The fields are parsed as JSON whenever possible.

```js
app.use(fileman.multiparser);
```

In the `next` callback you'll receive the parameters as usual:

```js
app.post('/', function (req, res, next) {
  var saved = [];

  req.files.forEach(function (file) {
    fileman.save(file, function (err, filedata) {
      if (err) {
        return next(err);
      }

      // Save the file data to a database entry or something alike

      saved.push(filedata);

      if (saved.length === req.files.length) {
        res.send(saved);
      }
    });
  });
});
```
So if the user makes a `POST` to `/`, like the example above, then the `req` object will contain the corresponding files and fields.

### Save
Use this method to save a file to the specified `stordir`. Useful for storing temporal uploaded files. It must be called with three parameters:

  - **filedata**: This is an `Object` containing the file's data, composed of the following properties:
    - **path**: This is required and must be a `String` with the full path to the file to read.
    - **name**: An optional `String` with the file's name.
  - **destpath**: This is an optional `String` pointing to a folder relative to the `stordir`. If not passed then it'll save the files directly in the `stordir`.
  - **done**: A callback `Function` that will receive an `err` `Object` and a `filedata` `Object`. The `filedata` `Object` has the following properties:
    - **name**: A `String` with the uploaded file's name or `null`.
    - **path**: A `String` with the file's path relative to the `stordir`.
    - **md5**: A `String` with the file's MD5 hash.
    - **encoding**: A `String` with the detected encoding.
    - **size**: A `Number` with the detected file's size.
    - **type**: A `String` with the detected mimetype.
