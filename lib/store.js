const md5File = require('md5-file/promise');
const fs = require('fs-extra');
const path = require('path');
const is = require('fi-is');

/**
 * Moves an uploaded file to the specified stordir sub folder.
 *
 * @param {Object} fileinfo The file object obtained from the multipart form parser.
 * @param {String} stordir The destination path to save the file into.
 */
module.exports = async (fileinfo, stordir, dest) => {
  if (is.not.object(fileinfo) || is.empty(fileinfo)) {
    throw new Error('[fi-fileman/save] The fileinfo argument must be an [Object]');
  }

  if (is.not.string(stordir) || is.empty(stordir)) {
    throw new Error('[fi-fileman/save] The second argument must be a [String] with the stordir path');
  }

  const route = [stordir];

  if (is.string(dest) && is.not.empty(dest)) {
    route.push(dest);
  }

  const basepath = path.normalize(path.join(...route));
  const outpath = path.normalize(path.join(basepath, path.basename(fileinfo.path)));
  const finfo = {
    name: is.string(fileinfo.name) && fileinfo.name || null,
    path: outpath.replace(stordir, ''),
    encoding: fileinfo.encoding,
    type: fileinfo.mimetype
  };

  /* Obtain temp file stats to retrieve it's size */
  try {
    finfo.stats = await fs.stat(fileinfo.path);
    finfo.md5 = await md5File(fileinfo.path);

    await fs.move(fileinfo.path, outpath);

    return finfo;
  } catch (err) {
    await fs.remove(outpath);
    throw err;
  }
};
