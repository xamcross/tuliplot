'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function setup() {
  const dom = new JSDOM('', { url: 'https://dashdash.app/' });
  const win = dom.window;
  const posted = [];
  win.postMessage = (msg) => posted.push(msg);
  global.window = win;
  global.chrome = {
    runtime: {
      sendMessage: (msg, cb) => {
        if (msg.type === 'PING') {
          cb({ source: 'dashdash-ext', type: 'PONG', version: '1.0.0' });
        } else if (msg.type === 'REQUEST_HOST') {
          cb({ source: 'dashdash-ext', type: 'HOST_RESULT', origin: msg.origin, granted: true });
        }
      },
    },
  };
  delete require.cache[require.resolve('../content.js')];
  return { win, posted, mod: require('../content.js') };
}

test('forwards a page PING and posts PONG back to the page', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'dashdash', type: 'PING' } });
  assert.deepEqual(posted, [{ source: 'dashdash-ext', type: 'PONG', version: '1.0.0' }]);
});

test('forwards a page REQUEST_HOST and posts HOST_RESULT back', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({
    source: win,
    data: { source: 'dashdash', type: 'REQUEST_HOST', origin: 'https://mail.google.com' },
  });
  assert.deepEqual(posted, [{
    source: 'dashdash-ext', type: 'HOST_RESULT', origin: 'https://mail.google.com', granted: true,
  }]);
});

test('ignores messages whose source is not this window', () => {
  const { posted, mod } = setup();
  mod.handleWindowMessage({ source: {}, data: { source: 'dashdash', type: 'PING' } });
  assert.equal(posted.length, 0);
});

test('ignores messages with a foreign data.source', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'evil', type: 'PING' } });
  assert.equal(posted.length, 0);
});

test('ignores dashdash messages with an unknown type', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'dashdash', type: 'HACK' } });
  assert.equal(posted.length, 0);
});
