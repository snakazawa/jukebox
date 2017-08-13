const speaker = require('speaker');
const { Decoder: decoder } = require('lame');
const EventEmitter = require('events').EventEmitter;
const pcmVolume = require('pcm-volume');
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
    this._decoder = decoder();
    this._pcmVolume = pcmVolume();
    this._speaker = speaker();

    this._pcmVolume.setVolume(this.volume);
    this._decoder.on('format', data => {
      this._speaker._format(data);
    });

    this._stream.on('end', () => console.log('stream: on end'));
    this._stream.on('finish', () => console.log('speaker: on finish'));
    this._stream.on('close', () => console.log('speaker: on finish'));

    this._decoder.on('end', () => console.log('decoder: on end'));
    this._decoder.on('finish', () => console.log('decoder: on finish'));
    this._decoder.on('close', () => console.log('decoder: on finish'));

    this._pcmVolume.on('end', () => console.log('pcmVolume: on end'));
    this._pcmVolume.on('finish', () => console.log('speaker: on finish'));
    this._pcmVolume.on('close', () => console.log('speaker: on finish'));

    this._speaker.on('finish', () => console.log('speaker: on finish'));
    this._speaker.on('close', () => console.log('speaker: on finish'));

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
    const keys = ['_stream', '_decoder', '_pcmVolume', '_speaker'];
    const rKeys = keys.slice().reverse();

    // unpipe streams in reverse order of opening
    rKeys.forEach((key, i) => {
      if (!this[key]) return;
      if (i - 1 < 0) return;
      const nKey = rKeys[i - 1];
      if (!this[nKey]) return;
      console.log(`${key}.unpipe(${nKey})`);
      this[key].unpipe(this[nKey]);
    });

    // end streams in order of opening
    keys.forEach(key => {
      if (!this[key]) return;
      this[key].end();
    });

    // delete streams
    keys.forEach(key => {
      if (!this[key]) return;
      this[key] = null;
    });

    this.emit('stopped');
  }
};
