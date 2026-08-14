'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function setup() {
  const dom = new JSDOM('', { url: 'https://tuliplot.com/' });
  const win = dom.window;
  const posted = [];
  const sent = [];
  win.postMessage = (msg) => posted.push(msg);
  global.window = win;
  global.chrome = {
    runtime: {
      sendMessage: (msg, cb) => {
        sent.push(msg);
        if (msg.type === 'PING') {
          cb({ source: 'tuliplot-ext', type: 'PONG', version: '1.0.0' });
        } else if (msg.type === 'REQUEST_HOST') {
          cb({ source: 'tuliplot-ext', type: 'HOST_RESULT', origin: msg.origin, granted: true });
        } else if (msg.type === 'CHECK_HOST') {
          cb({ source: 'tuliplot-ext', type: 'HOST_STATUS', origin: msg.origin, granted: true });
        } else if (cb) {
          cb();
        }
      },
    },
  };
  delete require.cache[require.resolve('../content.js')];
  return { win, posted, sent, mod: require('../content.js') };
}

test('sends TAB_HELLO to the worker as soon as the script loads', () => {
  const { sent } = setup();
  assert.deepEqual(sent, [{ type: 'TAB_HELLO' }]);
});

test('forwards a page PING and posts PONG back to the page', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'tuliplot', type: 'PING' } });
  assert.deepEqual(posted, [{ source: 'tuliplot-ext', type: 'PONG', version: '1.0.0' }]);
});

test('forwards a page REQUEST_HOST and posts HOST_RESULT back', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({
    source: win,
    data: { source: 'tuliplot', type: 'REQUEST_HOST', origin: 'https://mail.google.com' },
  });
  assert.deepEqual(posted, [{
    source: 'tuliplot-ext', type: 'HOST_RESULT', origin: 'https://mail.google.com', granted: true,
  }]);
});

test('forwards a page CHECK_HOST and posts HOST_STATUS back', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({
    source: win,
    data: { source: 'tuliplot', type: 'CHECK_HOST', origin: 'https://www.youtube.com' },
  });
  assert.deepEqual(posted, [{
    source: 'tuliplot-ext', type: 'HOST_STATUS', origin: 'https://www.youtube.com', granted: true,
  }]);
});

test('ignores messages whose source is not this window', () => {
  const { posted, mod } = setup();
  mod.handleWindowMessage({ source: {}, data: { source: 'tuliplot', type: 'PING' } });
  assert.equal(posted.length, 0);
});

test('ignores messages with a foreign data.source', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'evil', type: 'PING' } });
  assert.equal(posted.length, 0);
});

test('ignores tuliplot messages with an unknown type', () => {
  const { win, posted, mod } = setup();
  mod.handleWindowMessage({ source: win, data: { source: 'tuliplot', type: 'HACK' } });
  assert.equal(posted.length, 0);
});
