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
  return function resolve(p) {
    var filepath = p || '';

    if (type.is(filepath, String)) {
      return path.normalize(path.join(config.stordir, (filepath || '')));
    }

    throw new Error("The path to resolve must be a [String]");
  };

};
