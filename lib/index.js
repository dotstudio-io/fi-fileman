const fs = require('fs-extra');
const path = require('path');
const is = require('fi-is');
const os = require('os');

const multiparserMiddleware = require('./multiparser');
const storeFile = require('./store');

/**
 * Joins, resolves and normalizes a path.
 *
 * @return {String} The clean path.
 */
function tidyPath () {
  return path.normalize(path.resolve(path.join.apply(path, arguments)));
}

/**
 * Fileman class.
 */
module.exports = {
  config: {},

  defaults: {
    stordir: tidyPath(process.env.HOME || process.env.USERPROFILE, 'fileman-storage'),
    tempdir: tidyPath(os.tmpdir(), 'fileman-uploads')
  },

  /**
   * Retrieves a configuration setting or its default.
   *
   * @return {Mixed} The value of the configuration field.
   */
  get (field) {
    return this.config[field] || this.defaults[field];
  },

  /**
   * Configures the module.
   *
   * Receives a configuration and applies it.
   *
   * @param {Object} config The configuration object.
   */
  configure (config) {
    if (!is.object(config)) {
      throw new Error('The config parameter must be an [Object]!');
    }

    if (is.string(config.tempdir)) {
      this.config.tempdir = path.normalize(config.tempdir);
    }

    if (is.string(config.stordir)) {
      this.config.stordir = path.normalize(config.stordir);
    }
  },

  /**
   * Multipart form data parser.
   *
   * @return Express Middleware
   */
  multiparser () {
    const tempdir = this.get('tempdir');
    return multiparserMiddleware(tempdir);
  },

  /**
   * Waits until the response is finished and unliks any uploaded files from the temp folder.
   *
   * @type Express Middleware.
   */
  cleaner () {
    return (req, res, next) => {
      res.once('finish', async () => {
        /* Check if files where uploaded */
        if (is.empty(req.files)) {
          return;
        }

        /* Unlink each file */
        for (const file of req.files) {
          if (is.string(file.path)) {
            await fs.remove(file.path);
          }
        }
      });

      next();
    };
  },

  /**
   * Resolves the full path relative to the stordir of a file.
   *
   * @param {Mixed} param The relative path to the file as a [String] or a fileinfo [Object].
   *
   * @return {String} The resolved path.
   */
  resolve (param) {
    const stordir = this.get('stordir');
    let filepath;

    if (is.string(param)) {
      filepath = param;
    } else if (is.object(param) && is.string(param.path)) {
      filepath = param.path;
    } else {
      throw new Error('The argument must be a path [String] or a fileinfo [Object]');
    }

    return path.normalize(path.join(stordir, filepath));
  },

  /**
   * Saves a file to the storage dir.
   *
   * @param {String} fileinfo The file info object.
   * @param {String} dest The destination path relative to the store directory.
   */
  save (fileinfo, dest) {
    return storeFile(fileinfo, this.get('stordir'), dest);
  },

  /**
   * Reads a file from the storage dir.
   *
   * @param {Mixed} filepath The relative path to the file as a [String] or a
   * fileinfo [Object].
   *
   * @return {Stream} The resulting read Stream.
   */
  read (filepath) {
    return fs.createReadStream(this.resolve(filepath));
  },

  /**
   * Removes a file from the storage dir.
   *
   * @param {String} path The relative path to the file.
   * @param {Function} done The done callback.
   */
  remove (filepath) {
    return fs.remove(this.resolve(filepath));
  },

  /**
   * Creates a new Fileman instance.
   *
   * @return {Fileman}
   */
  anew () {
    return { ...this };
  }
};
