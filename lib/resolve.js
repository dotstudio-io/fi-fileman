'use strict';

var type = require('type-of-is');
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
    var fpath = filepath || '';

    if (type.is(filepath, String)) {
      return path.normalize(path.join(config.stordir, (fpath || '')));
    }

    throw new Error("The path to resolve must be a [String]");
  };

};
