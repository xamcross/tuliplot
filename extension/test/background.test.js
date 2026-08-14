'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function installChrome(overrides) {
  const opts = overrides || {};
  const registered = [];
  const sessionRules = [];
  global.chrome = {
    __registered: registered,
    __sessionRules: sessionRules,
    __ruleUpdates: [],
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
    declarativeNetRequest: {
      getSessionRules: (cb) => cb(sessionRules.slice()),
      updateSessionRules: (update, cb) => {
        global.chrome.__ruleUpdates.push(update);
        for (const id of update.removeRuleIds || []) {
          const i = sessionRules.findIndex((r) => r.id === id);
          if (i !== -1) {
            sessionRules.splice(i, 1);
          }
        }
        for (const rule of update.addRules || []) {
          sessionRules.push(rule);
        }
        if (cb) cb();
      },
    },
    tabs: {
      __removedListeners: [],
      query: (q, cb) => {
        global.chrome.__lastTabQuery = q;
        cb(opts.openTabs || []);
      },
      onRemoved: { addListener: (fn) => global.chrome.tabs.__removedListeners.push(fn) },
    },
  };
}

function freshBackground() {
  delete require.cache[require.resolve('../background.js')];
  return require('../background.js');
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function sessionRule() {
  return global.chrome.__sessionRules.find((r) => r.id === 1);
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

test('TAB_HELLO adds a tab-scoped sub_frame header rule without initiatorDomains', async () => {
  installChrome();
  const { handleMessage } = freshBackground();
  const ret = handleMessage({ type: 'TAB_HELLO' }, { tab: { id: 7 } }, () => {});
  assert.equal(ret, false);
  await flush();
  const rule = sessionRule();
  assert.ok(rule, 'expected the session rule to exist');
  assert.equal(rule.action.type, 'modifyHeaders');
  const removed = rule.action.responseHeaders
    .filter((h) => h.operation === 'remove')
    .map((h) => h.header)
    .sort();
  assert.deepEqual(removed, ['content-security-policy', 'x-frame-options']);
  assert.deepEqual(rule.condition.resourceTypes, ['sub_frame']);
  assert.deepEqual(rule.condition.tabIds, [7]);
  assert.equal(rule.condition.initiatorDomains, undefined);
});

test('a second dashboard tab joins the same session rule', async () => {
  installChrome();
  const { handleMessage } = freshBackground();
  handleMessage({ type: 'TAB_HELLO' }, { tab: { id: 7 } }, () => {});
  await flush();
  handleMessage({ type: 'TAB_HELLO' }, { tab: { id: 9 } }, () => {});
  await flush();
  assert.deepEqual(sessionRule().condition.tabIds.sort(), [7, 9]);
});

test('a duplicate TAB_HELLO does not rewrite the rule', async () => {
  installChrome();
  const { handleMessage } = freshBackground();
  handleMessage({ type: 'TAB_HELLO' }, { tab: { id: 7 } }, () => {});
  await flush();
  const updates = global.chrome.__ruleUpdates.length;
  handleMessage({ type: 'TAB_HELLO' }, { tab: { id: 7 } }, () => {});
  await flush();
  assert.equal(global.chrome.__ruleUpdates.length, updates);
});

test('TAB_HELLO without a sender tab is ignored', async () => {
  installChrome();
  const { handleMessage } = freshBackground();
  const before = global.chrome.__ruleUpdates.length;
  handleMessage({ type: 'TAB_HELLO' }, {}, () => {});
  await flush();
  assert.equal(global.chrome.__ruleUpdates.length, before);
});

test('PING also registers the sender tab', async () => {
  installChrome();
  const { handleMessage } = freshBackground();
  let response;
  handleMessage({ type: 'PING' }, { tab: { id: 3 } }, (r) => { response = r; });
  await flush();
  assert.equal(response.type, 'PONG');
  assert.deepEqual(sessionRule().condition.tabIds, [3]);
});

test('closing the last dashboard tab removes the session rule', async () => {
  installChrome();
  const { handleMessage } = freshBackground();
  handleMessage({ type: 'TAB_HELLO' }, { tab: { id: 7 } }, () => {});
  await flush();
  assert.ok(sessionRule());
  for (const listener of global.chrome.tabs.__removedListeners) {
    listener(7);
  }
  await flush();
  assert.equal(sessionRule(), undefined);
  const last = global.chrome.__ruleUpdates[global.chrome.__ruleUpdates.length - 1];
  assert.deepEqual(last.removeRuleIds, [1]);
  assert.equal(last.addRules, undefined);
});

test('the worker rebuilds the rule from open dashboard tabs at startup', async () => {
  installChrome({ openTabs: [{ id: 4 }, { id: 8 }] });
  freshBackground();
  await flush();
  assert.deepEqual(global.chrome.__lastTabQuery, { url: ['*://tuliplot.com/*', 'http://localhost/*'] });
  assert.deepEqual(sessionRule().condition.tabIds.sort(), [4, 8]);
});
