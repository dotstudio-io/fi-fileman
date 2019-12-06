const EventEmitter = require('events');
const uuidv4 = require('uuid/v4');
const fs = require('fs-extra');
const path = require('path');

/**
 * Parser class.
 */
class Parser extends EventEmitter {
  /**
   * @constructor
   */
  constructor(tempdir) {
    super();

    this.tempdir = tempdir;
    this.filepaths = [];

    this.finished = false;
    this.fields = 0;
    this.files = 0;
  }

  /**
   * On file callback.
   */
  async onFile (fieldname, file, filename, encoding, mimetype) {
    const outname = `${uuidv4()}${path.extname(filename)}`;
    const filepath = path.normalize(path.join(this.tempdir, outname));

    this.filepaths.push(filepath);

    this.emit('file', {
      encoding: encoding,
      mimetype: mimetype,
      field: fieldname,
      path: filepath,
      type: mimetype,
      name: filename
    });

    try {
      await fs.ensureDir(path.dirname(filepath));

      const writer = fs.createWriteStream(filepath);

      file.pipe(writer);

      writer.on('finish', () => {
        this.files++;
        this.emit('complete');
      });

      writer.on('error', (err) => {
        throw err;
      });
    } catch (err) {
      this.onError(err);
    }
  }

  /**
   * Tries to parse a received field.
   */
  onField (field, value) {
    /* Try to parse the field as JSON */
    try {
      value = JSON.parse(value);
    } catch (e) {
      // Not JSON
    }

    this.emit('field', field, value);

    this.fields++;

    this.emit('complete');
  }

  /**
   * Parser has finished.
   */
  onFinish () {
    this.finished = true;
    this.emit('complete');
  }

  /**
   * Updates saved files counter and completes.
   */
  onError (err) {
    if (err) {
      this.emit('error', err);
      console.error(err);
    } else {
      const err = new Error('[fi-fileman] Unknown parser error');

      this.emit('error', err);

      console.error(err);
    }

    for (const fileinfo of this.filepaths) {
      fs.remove(fileinfo.path);
    }
  }
}

module.exports = Parser;
