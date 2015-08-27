'use strict';

var path = require('path');

module.exports = function (config) {

  /**
   * Resolves a file's full path relative to the stordir.
   *
   * @param {String} path The relative path to the file
   *
   * @return {String} The full path to the file
   */
  return function resolve(filepath) {
    return path.normalize(path.join(config.stordir, filepath));
  };

};
