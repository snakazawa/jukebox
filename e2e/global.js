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
      sinon.stub(speaker.prototype, '_open').callsFake(() => {});
      sinon.stub(speaker.prototype, '_format').callsFake(() => {});
      sinon.stub(speaker.prototype, '_write').callsFake((chunk, encoding, cb) => {
        cb();
      });
      sinon.stub(speaker.prototype, '_flush').callsFake(function dummyFlush() {
        this.emit('flush');
        this.close();
      });
      sinon.stub(speaker.prototype, 'close').callsFake(function dummyClose() {
        this.emit('close');
      });
      sinon.stub(speaker.prototype, '_pipe').callsFake(() => {});
      sinon.stub(speaker.prototype, '_unpipe').callsFake(() => {});
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
