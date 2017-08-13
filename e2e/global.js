const { server, reload, storeHelper } = require('../tests/helper');
const enableDestroy = require('server-destroy');
const speaker = require('speaker');
/* eslint-disable import/no-extraneous-dependencies */
const sinon = require('sinon');
/* eslint-enable import/no-extraneous-dependencies */
const E2EHelper = require('./e2e_helper');

enableDestroy(server);

module.exports = {
  before(done) {
    storeHelper.makeStub();

    if (E2EHelper.E2E_USE_DUMMY_SPEAKER) {
      console.log('use dummy speaker');
      sinon.stub(speaker.prototype, '_open').callsFake(() => {
        console.log('_open');
      });
      sinon.stub(speaker.prototype, '_format').callsFake(() => {
        console.log('_format');
      });
      sinon.stub(speaker.prototype, '_write').callsFake((chunk, encoding, cb) => {
        cb();
      });
      sinon.stub(speaker.prototype, '_flush').callsFake(function dummyFlush() {
        console.log('_flush');
        this.emit('flush');
        this.close();
      });
      sinon.stub(speaker.prototype, 'close').callsFake(function dummyClose() {
        console.log('close');
        this.emit('close');
      });
      sinon.stub(speaker.prototype, '_pipe').callsFake(() => {
        console.log('_pipe');
      });
      sinon.stub(speaker.prototype, '_unpipe').callsFake(() => {
        console.log('_unpipe');
      });
    }

    done();
  },

  after() {
    storeHelper.clearStore();
    server.destroy();
  },

  beforeEach(done) {
    storeHelper.clearStore();
    reload();
    done();
  },

  reporter(results, done) {
    done();

    // force exit
    const code = results.failed || results.errors ? 1 : 0;
    setTimeout(() => {
      console.warn(`Force exit server with code ${code}.`);
      process.exit(code);
    }, 3000);
  }
};
