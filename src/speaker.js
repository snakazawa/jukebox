// const speaker = require('speaker');
// const { Decoder: decoder } = require('lame');
const EventEmitter = require('events').EventEmitter;
// const pcmVolume = require('pcm-volume');
const AwaitLock = require('await-lock');

module.exports = class Speaker extends EventEmitter {
  constructor({ volume = 1 } = {}) {
    super();
    this.lock = new AwaitLock();

    this._volume = volume;

    this._stream = null;
    this._decoder = null;
    this._pcmVolume = null;
    this._speaker = null;
  }

  get volume() {
    return this._volume;
  }

  set volume(volume) {
    if (this._pcmVolume) {
      this._pcmVolume.setVolume(volume);
    }
    this._volume = volume;
  }

  async start(stream) {
    await this.lock.acquireAsync();

    try {
      this.startWithoutLock(stream);
    } finally {
      this.lock.release();
    }
  }

  async pause() {
    await this.lock.acquireAsync();

    try {
      this.pauseWithoutLock();
    } finally {
      this.lock.release();
    }
  }

  async resume() {
    await this.lock.acquireAsync();

    try {
      this.resumeWithoutLock();
    } finally {
      this.lock.release();
    }
  }

  async stop() {
    await this.lock.acquireAsync();

    try {
      this.stopWithoutLock();
    } finally {
      this.lock.release();
    }
  }

  startWithoutLock(stream) {
    this._stream = stream;
    // this._decoder = decoder();
    // this._pcmVolume = pcmVolume();
    // this._speaker = speaker();
    this._decoder = {
      write() {},
      read() {},
      end() {},
      format() {},
      _write() {},
      _read() {},
      _format() {},
      on() {},
      emit() {},
      once() {},
      pipe(dest) {
        return dest;
      },
      unpipe() {}
    };
    this._pcmVolume = {
      setVolume() {},
      write() {},
      read() {},
      end() {},
      format() {},
      _write() {},
      _read() {},
      _format() {},
      on() {},
      emit() {},
      once() {},
      pipe(dest) {
        return dest;
      },
      unpipe() {}
    };
    this._speaker = {
      write() {},
      end() {},
      format() {},
      _write() {},
      _format() {},
      on() {},
      emit() {},
      once() {}
    };

    this._pcmVolume.setVolume(this.volume);
    this._decoder.on('format', data => {
      console.log('call format on decoder format event');
      this._speaker._format(data);
      console.log('success: call format on decoder format event');
    });

    this._stream
      .pipe(this._decoder)
      .pipe(this._pcmVolume)
      .pipe(this._speaker)
      .on('close', () => this.stop());

    this.emit('start');
  }

  pauseWithoutLock() {
    this._pcmVolume.unpipe(this._speaker);
    this.emit('paused');
  }

  resumeWithoutLock() {
    this._pcmVolume.pipe(this._speaker);
    this.emit('resumed');
  }

  stopWithoutLock() {
    if (this._speaker) {
      // this._speaker.removeAllListeners();
    }

    const keys = ['_stream', '_decoder', '_pcmVolume', '_speaker'];
    const rKeys = keys.slice().reverse();

    // end streams in order of opening
    keys.forEach(key => {
      if (!this[key]) return;
      this[key].end();
    });

    // unpipe streams in reverse order of opening
    rKeys.forEach((key, i) => {
      if (!this[key]) return;
      if (i - 1 < 0) return;
      const nKey = rKeys[i - 1];
      if (!this[nKey]) return;
      console.log(`${key}.unpipe(${nKey})`);
      this[key].unpipe(this[nKey]);
    });

    // delete streams
    keys.forEach(key => {
      if (!this[key]) return;
      this[key] = null;
    });

    this.emit('stopped');
  }
};
