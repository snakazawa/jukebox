const speaker = require('speaker');
const EventEmitter = require('events').EventEmitter;
const pcmVolume = require('pcm-volume');
const AwaitLock = require('await-lock');
const TimedStream = require('timed-stream');
const FFmpeg = require('fluent-ffmpeg');
const EvenizeStream = require('./util/evenize_stream');

module.exports = class Speaker extends EventEmitter {
  constructor({ volume = 1 } = {}) {
    super();
    this.lock = new AwaitLock();

    this._volume = volume;

    this._stream = null;
    this._pcmVolume = null;
    this._speaker = null;
    this._timedStream = null;
    this._ffmpeg = null;
    this._readableFFmpeg = null;
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
      await this.startWithoutLock(stream);
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

  async startWithoutLock(stream) {
    return new Promise(resolve => {
      const { sampleRate, byteDepth, channels } = this.constructor.format;

      this._stream = stream;
      this._stream.on('error', err => console.error('error on stream, ', err));

      this._ffmpeg = new FFmpeg()
        .format('s16le')
        .audioFrequency(sampleRate)
        .withAudioChannels(channels);
      this._ffmpeg.on('error', err => console.error('error on ffmpeg, ', err));

      this._timedStream = new TimedStream({
        rate: byteDepth * channels * sampleRate,
        period: 10
      });
      this._timedStream.on('error', err => console.error('error on timedStream, ', err));
      this._timedStream.pauseStream();

      this._evenizeStream = new EvenizeStream();
      this._evenizeStream.on('error', err => console.log('error on evenizeStream, ', err));

      this._pcmVolume = pcmVolume();
      this._pcmVolume.setVolume(this.volume);
      this._pcmVolume.on('error', err => console.error('error on pcmVolume, ', err));

      this._speaker = speaker();
      this._speaker.on('error', err => console.error('error on speaker, ', err));

      this._readableFFmpeg = this._ffmpeg
        .input(this._stream)
        .pipe()
        .on('error', err => console.error('error on readableFFmpeg, ', err))
        .once('data', () => {
          this._readableFFmpeg
            .pipe(this._timedStream)
            .pipe(this._evenizeStream)
            .pipe(this._pcmVolume)
            .pipe(this._speaker)
            .on('close', () => this.stop());
          this._timedStream.resumeStream();

          this.emit('start');
          resolve();
        });
    });
  }

  pauseWithoutLock() {
    this._timedStream.pauseStream();
    this.emit('paused');
  }

  resumeWithoutLock() {
    this._timedStream.resumeStream();
    this.emit('resumed');
  }

  stopWithoutLock() {
    if (this._stream) {
      this._stream.destroy();
    }
    if (this._timedStream) {
      this._timedStream.destroy();
    }
    this.emit('stopped');
  }

  static get format() {
    return {
      sampleRate: 44100,
      bitDepth: 16,
      byteDepth: 16 / 2,
      channels: 2
    };
  }
};
