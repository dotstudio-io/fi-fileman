'use strict';

var path = require('path');

module.exports = {

  stordir: path.normalize(path.join(__dirname, 'storage')),

  tempdir: path.normalize(path.join(__dirname, 'uploads'))

};
