'use strict';

var type = require('type-of-is');
var fs = require('fs-extra');

module.exports = function (config) {

  var debug = config.debug;

  /**
   * Waits until the response is finished and unliks any uploaded files from the temp folder.
   *
   * @type Express Middleware
   */
  return function cleaner(req, res, next) {
    res.on('finish', function () {
      /* Check if files qhere uploaded */
      if (type.is(req.files, Array) && req.files.length) {
        debug("[Cleaner] Removing " + req.files.length + " uploaded files...");

        /* Unlink each file */
        req.files.forEach(function (file) {
          fs.remove(file.path, function (err) {
            if (err) {
              debug("[Cleaner] Couldn't clean uploaded file");
              debug(file);
              debug(err);
            }
          });
        });
      }
    });

    next();
  };

};
