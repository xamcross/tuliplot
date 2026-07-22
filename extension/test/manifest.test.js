'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadManifest() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

test('manifest.json parses as a JSON object', () => {
  const m = loadManifest();
  assert.equal(typeof m, 'object');
  assert.notEqual(m, null);
});

test('manifest declares required MV3 keys', () => {
  const m = loadManifest();
  assert.equal(m.manifest_version, 3);
  assert.equal(typeof m.name, 'string');
  assert.ok(m.name.length > 0);
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof m.description, 'string');
});

test('manifest requests only the DNR-with-host-access permission', () => {
  const m = loadManifest();
  assert.deepEqual(m.permissions, ['declarativeNetRequestWithHostAccess']);
  assert.deepEqual(m.optional_host_permissions, ['*://*/*']);
  assert.deepEqual(m.host_permissions, ['*://tuliplot.com/*', 'http://localhost/*']);
});

test('manifest wires the static DNR ruleset', () => {
  const m = loadManifest();
  const resources = m.declarative_net_request.rule_resources;
  assert.equal(resources.length, 1);
  assert.equal(resources[0].id, 'tuliplot_frame');
  assert.equal(resources[0].path, 'rules.json');
  assert.equal(resources[0].enabled, true);
});

test('manifest wires background worker and document_start content script', () => {
  const m = loadManifest();
  assert.equal(m.background.service_worker, 'background.js');
  const cs = m.content_scripts[0];
  assert.deepEqual(cs.matches, ['*://tuliplot.com/*', 'http://localhost/*']);
  assert.deepEqual(cs.js, ['content.js']);
  assert.equal(cs.run_at, 'document_start');
});
