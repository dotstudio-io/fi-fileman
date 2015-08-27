'use strict';

var fs = require('fs-extra');

module.exports = function (config) {

  /**
   * Reads a file from the storage dir.
   *
   * @param {String} path The relative path to the file
   *
   * @return {ReadableStream} The read stream for the file
   */
  return function read(filepath) {
    var resolve = require('./resolve')(config);

    return fs.createReadStream(resolve(filepath));
  };

};
