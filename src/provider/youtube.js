const ytdl = require('ytdl-core');
const FFmpeg = require('fluent-ffmpeg');
const request = require('request-promise');
const memorize = require('promise-memorize');
const { PassThrough } = require('stream');

const CACHE_TIME = Number(process.env.JUKEBOX_CACHE_TIME || 60 * 1000);

const memorizedRequest = memorize(request, CACHE_TIME);
const memorizedYtdlGetInfo = memorize(ytdl.getInfo.bind(ytdl), CACHE_TIME);

module.exports = {
  name: 'youtube',
  pattern: /https?:\/\/(www\.)?youtu(be\.com\/watch\?v=|\.be\/)(.+)/,
  sizeList: ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'],

  getId(link) {
    return this.pattern.exec(link)[3];
  },

  async getThumbnailLink(link) {
    // Don't use `for of` because of serial processing
    const uris = await Promise.all(
      this.sizeList.map(async size => {
        const uri = `http://i.ytimg.com/vi/${this.getId(link)}/${size}.jpg`;
        try {
          await memorizedRequest({ method: 'HEAD', uri });
          return uri;
        } catch (e) {
          return null;
        }
      })
    );

    return uris.find(Boolean) || null;
  },

  async _getInfo(link) {
    try {
      return await memorizedYtdlGetInfo(link);
    } catch (e) {
      return null;
    }
  },

  async getLengthSeconds(link) {
    const info = await this._getInfo(link);
    if (!info) return null;
    return info.length_seconds;
  },

  async getTitle(link) {
    const info = await this._getInfo(link);
    if (!info) return null;
    return info.title;
  },

  createStream(link) {
    const opts = {
      filter: 'audioonly',
      quality: 'lowest'
    };

    const audio = ytdl(link, opts);
    const ffmpeg = new FFmpeg(audio);
    const cmd = ffmpeg.format('mp3').on('error', err => {
      // ignore self kill message
      if (cmd.isKilled && /was killed/.test(err.message)) return;
      console.error('error on ffmpeg cmd for youtube', err);
    });
    cmd.isKilled = false;

    const stream = new PassThrough();
    stream.endOrig = stream.end;
    stream.end = function endWrap(...args) {
      cmd.isKilled = true;
      cmd.kill();
      // safe end
      setTimeout(() => this.endOrig(...args), 3000);
    };

    return cmd.pipe(stream); // run
  }
};
