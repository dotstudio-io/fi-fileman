'use strict';

const fs = require('fs-extra');
const uuid = require('uuid');
const path = require('path');

const ERR_UNKNOWN = new Error('[fi-fileman] Unknown parser error');

const FINISH = 'finish';
const ERROR = 'error';

/**
 * Parser class.
 */
class Parser {
  /**
   * @constructor
   */
  constructor(tempdir, req, next) {
    this.tempdir = tempdir;
    this.next = next;
    this.req = req;

    this.finished = false;
    this.fields = 0;
    this.files = {
      uploaded: 0,
      saved: 0
    };
  }

  /**
   * Helper function to deal with asyncronisity.
   */
  complete() {
    var isComplete = this.finished &&
      this.files.uploaded === this.files.saved &&
      Object.keys(this.req.body).length === this.fields;

    if (isComplete) {
      this.next();
    }
  }

  onFile(fieldname, file, filename, encoding, mimetype) {
    this.files.uploaded++;

    var filepath = path.normalize(path.join(this.tempdir, uuid.v4() + path.extname(filename)));
    var writer = fs.createOutputStream(filepath);

    this.req.files.push({
      encoding: encoding,
      mimetype: mimetype,
      field: fieldname,
      path: filepath,
      type: mimetype,
      name: filename,
    });

    writer.once(FINISH, () => {
      this.onFileSaved();
    });

    writer.once(ERROR, (err) => {
      this.onError(err);
    });

    file.once(ERROR, (err) => {
      this.onError(err);
    });

    file.pipe(writer);
  }

  /**
   * Updates saved files counter and completes.
   */
  onFileSaved() {
    this.files.saved++;
    this.complete();
  }

  /**
   * Tries to parse a received field.
   */
  onField(field, value) {
    this.fields++;

    /* Try to parse the field as JSON */
    try {
      this.req.body[field] = JSON.parse(value);
    } catch (e) {
      this.req.body[field] = value;
    }

    this.complete();
  }

  /**
   * Parser has finished.
   */
  onceFinished() {
    this.finished = true;
    this.complete();
  }

  /**
   * Updates saved files counter and completes.
   */
  onError(err) {
    if (err) {
      console.error(err);
      this.next(err);
    } else {
      console.error(ERR_UNKNOWN);
      this.next(ERR_UNKNOWN);
    }
  }
}

module.exports = Parser;
