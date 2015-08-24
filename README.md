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
This component must be configured before using it:

```js
var fileman = require('fi-seed-component-fileman');
var app = require('express')();
var path = require('path');

//...
app.use(fileman.multiparser);
//...
app.use(fileman.uploadedFilesCleaner);

//...
```

### Configuration
An `Object` with the following parameters:
- **tempdir**: This is required and must be a `string`. This is the absolute path where the schemas are located.
- **stordir**: This is optional and must be an `Array` to apply to each schema exports right after the default `mongoose.Schema` argument.
- **debug**: This is optional and can be a `Function` to log with or a `Boolean`. If `true` it will use `console.log`.

```js
'use strict';

var path = require('path');
var os = require('os');

module.exports = {

  tempdir: path.normalize(path.join(os.tmpDir(), 'savina', 'uploads')),

  stordir: path.normalize(path.join(__appdir, '..', 'savina-storage')),

  debug: require('debug')('app:fileman')

};
```
