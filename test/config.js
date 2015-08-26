'use strict';

var path = require('path');
var util = require('util');
var fs = require('fs');

var logfile = path.join(__dirname, 'fileman.log');

module.exports = {

  stordir: path.normalize(path.join(__dirname, 'storage')),

  tempdir: path.normalize(path.join(__dirname, 'uploads')),

  debug: function () {
    var content = '\n';

    for (var arg in arguments) {
      content += new Date().toISOString() + ':\n' + util.inspect(arguments[arg], {
        showHidden: true,
        colors: false,
        depth: null
      }).toString() + '\n\n';
    }

    fs.appendFile(logfile, content, function (err, data) {
      if (err) {
        throw err;
      }
    });
  }

};
