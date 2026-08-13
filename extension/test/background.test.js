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
      contains: (spec, cb) => {
        global.chrome.__lastContains = spec;
        cb(Object.prototype.hasOwnProperty.call(opts, 'contains') ? opts.contains : false);
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
  assert.deepEqual(response, { source: 'tuliplot-ext', type: 'PONG', version: '1.0.0' });
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
    source: 'tuliplot-ext', type: 'HOST_RESULT', origin: 'https://mail.google.com', granted: true,
  });
});

test('REQUEST_HOST reports granted=false when the user denies', () => {
  installChrome({ granted: false });
  const { handleMessage } = require('../background.js');
  let response;
  handleMessage({ type: 'REQUEST_HOST', origin: 'https://mail.google.com' }, {}, (r) => { response = r; });
  assert.equal(response.granted, false);
});

test('REQUEST_HOST with a valid https origin requests+grants the host permission', () => {
  installChrome({ granted: true });
  const { handleMessage } = require('../background.js');
  let response;
  const ret = handleMessage(
    { type: 'REQUEST_HOST', origin: 'https://good.example.com' }, {}, (r) => { response = r; },
  );
  assert.equal(ret, true);
  assert.deepEqual(global.chrome.__lastRequest, { origins: ['https://good.example.com/*'] });
  assert.equal(response.granted, true);
});

test('REQUEST_HOST rejects wildcard/malformed origins without calling permissions.request', () => {
  const bad = [
    '*://*',
    'https://*.evil.com',
    'notaurl',
    'https://x.com/path',
    'https://x.com/?q=1',
    'ftp://x.com',
    '',
  ];
  for (const origin of bad) {
    installChrome({ granted: true });
    const { handleMessage } = require('../background.js');
    let response;
    const ret = handleMessage({ type: 'REQUEST_HOST', origin: origin }, {}, (r) => { response = r; });
    assert.equal(ret, false, `expected sync rejection for ${JSON.stringify(origin)}`);
    assert.equal(global.chrome.__lastRequest, undefined,
      `permissions.request must not be called for ${JSON.stringify(origin)}`);
    assert.equal(response.granted, false, `expected granted=false for ${JSON.stringify(origin)}`);
    assert.equal(response.type, 'HOST_RESULT');
  }
});

test('CHECK_HOST reports granted=true when the origin permission is present', () => {
  installChrome({ contains: true });
  const { handleMessage } = require('../background.js');
  let response;
  const ret = handleMessage(
    { type: 'CHECK_HOST', origin: 'https://www.youtube.com' }, {}, (r) => { response = r; },
  );
  assert.equal(ret, true);
  assert.deepEqual(global.chrome.__lastContains, { origins: ['https://www.youtube.com/*'] });
  assert.deepEqual(response, {
    source: 'tuliplot-ext', type: 'HOST_STATUS', origin: 'https://www.youtube.com', granted: true,
  });
});

test('CHECK_HOST reports granted=false when the origin permission is absent', () => {
  installChrome({ contains: false });
  const { handleMessage } = require('../background.js');
  let response;
  handleMessage({ type: 'CHECK_HOST', origin: 'https://www.youtube.com' }, {}, (r) => { response = r; });
  assert.equal(response.granted, false);
  assert.equal(response.type, 'HOST_STATUS');
});

test('CHECK_HOST rejects wildcard/malformed origins without calling permissions.contains', () => {
  const bad = ['*://*', 'https://*.evil.com', 'notaurl', 'https://x.com/path', ''];
  for (const origin of bad) {
    installChrome({ contains: true });
    const { handleMessage } = require('../background.js');
    let response;
    const ret = handleMessage({ type: 'CHECK_HOST', origin: origin }, {}, (r) => { response = r; });
    assert.equal(ret, false, `expected sync rejection for ${JSON.stringify(origin)}`);
    assert.equal(global.chrome.__lastContains, undefined,
      `permissions.contains must not be called for ${JSON.stringify(origin)}`);
    assert.equal(response.granted, false, `expected granted=false for ${JSON.stringify(origin)}`);
    assert.equal(response.type, 'HOST_STATUS');
  }
});

test('unknown message types are ignored (no response, returns false)', () => {
  installChrome();
  const { handleMessage } = require('../background.js');
  let called = false;
  const ret = handleMessage({ type: 'NOPE' }, {}, () => { called = true; });
  assert.equal(ret, false);
  assert.equal(called, false);
});
