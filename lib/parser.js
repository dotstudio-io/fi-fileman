'use strict';

const EventEmitter = require('events');
const fs = require('fs-promise');
const uuid = require('uuid');
const path = require('path');

const ERR_UNKNOWN = new Error('[fi-fileman] Unknown parser error');

const COMPLETE = 'complete';
const FINISH = 'finish';
const ERROR = 'error';
const FIELD = 'field';
const FILE = 'file';

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

  onFile(fieldname, file, filename, encoding, mimetype) {
    var outname = uuid.v4() + path.extname(filename);
    var filepath = path.normalize(path.join(this.tempdir, outname));

    this.filepaths.push(filepath);

    this.emit(FILE, {
      encoding: encoding,
      mimetype: mimetype,
      field: fieldname,
      path: filepath,
      type: mimetype,
      name: filename
    });

    return fs.ensureDir(path.dirname(filepath)).then(() => {
      var writer = fs.createWriteStream(filepath);

      file.pipe(writer);

      writer.on(FINISH, () => {
        this.files++;
        this.emit(COMPLETE);
      });

      writer.on(ERROR, (err) => {
        throw err;
      });
    }).catch((err) => {
      this.onError(err);
    });
  }

  /**
   * Tries to parse a received field.
   */
  onField(field, value) {
    /* Try to parse the field as JSON */
    try {
      value = JSON.parse(value);
    } catch (e) {
      // Not JSON
    }

    this.emit(FIELD, field, value);

    this.fields++;

    this.emit(COMPLETE);
  }

  /**
   * Parser has finished.
   */
  onFinish() {
    this.finished = true;
    this.emit(COMPLETE);
  }

  /**
   * Updates saved files counter and completes.
   */
  onError(err) {
    if (err) {
      this.emit(ERROR, err);
      console.error(err);
    } else {
      this.emit(ERROR, ERR_UNKNOWN);
      console.error(ERR_UNKNOWN);
    }

    this.filepaths.forEach((fileinfo) => {
      fs.remove(fileinfo.path);
    });
  }
}

module.exports = Parser;
