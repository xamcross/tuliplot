'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function installChrome(overrides) {
  const opts = overrides || {};
  const registered = [];
  global.chrome = {
    __registered: registered,
    runtime: {
      onMessage: { addListener: (fn) => registered.push(fn) },
      getManifest: () => ({ version: '1.0.0' }),
    },
    permissions: {
      request: (spec, cb) => {
        global.chrome.__lastRequest = spec;
        cb(Object.prototype.hasOwnProperty.call(opts, 'granted') ? opts.granted : true);
      },
    },
  };
}

test('the worker registers a runtime.onMessage listener on load', () => {
  installChrome();
  delete require.cache[require.resolve('../background.js')];
  require('../background.js');
  assert.equal(global.chrome.__registered.length, 1);
});

test('PING responds with PONG carrying the manifest version', () => {
  installChrome();
  const { handleMessage } = require('../background.js');
  let response;
  const ret = handleMessage({ type: 'PING' }, {}, (r) => { response = r; });
  assert.equal(ret, false);
  assert.deepEqual(response, { source: 'dashdash-ext', type: 'PONG', version: '1.0.0' });
});

test('REQUEST_HOST requests the origin wildcard and reports granted=true', () => {
  installChrome({ granted: true });
  const { handleMessage } = require('../background.js');
  let response;
  const ret = handleMessage(
    { type: 'REQUEST_HOST', origin: 'https://mail.google.com' }, {}, (r) => { response = r; },
  );
  assert.equal(ret, true);
  assert.deepEqual(global.chrome.__lastRequest, { origins: ['https://mail.google.com/*'] });
  assert.deepEqual(response, {
    source: 'dashdash-ext', type: 'HOST_RESULT', origin: 'https://mail.google.com', granted: true,
  });
});

test('REQUEST_HOST reports granted=false when the user denies', () => {
  installChrome({ granted: false });
  const { handleMessage } = require('../background.js');
  let response;
  handleMessage({ type: 'REQUEST_HOST', origin: 'https://mail.google.com' }, {}, (r) => { response = r; });
  assert.equal(response.granted, false);
});

test('unknown message types are ignored (no response, returns false)', () => {
  installChrome();
  const { handleMessage } = require('../background.js');
  let called = false;
  const ret = handleMessage({ type: 'NOPE' }, {}, () => { called = true; });
  assert.equal(ret, false);
  assert.equal(called, false);
});
