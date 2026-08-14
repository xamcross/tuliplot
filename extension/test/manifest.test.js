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

test('manifest declares no static DNR ruleset (the worker owns a session rule)', () => {
  const m = loadManifest();
  assert.equal(m.declarative_net_request, undefined);
});

test('manifest wires background worker and document_start content script', () => {
  const m = loadManifest();
  assert.equal(m.background.service_worker, 'background.js');
  const cs = m.content_scripts[0];
  assert.deepEqual(cs.matches, ['*://tuliplot.com/*', 'http://localhost/*']);
  assert.deepEqual(cs.js, ['content.js']);
  assert.equal(cs.run_at, 'document_start');
});

test('manifest declares icons at 16, 32, 48 and 128', () => {
  const m = loadManifest();
  assert.deepEqual(Object.keys(m.icons).sort((a, b) => a - b), ['16', '32', '48', '128']);
  for (const size of [16, 32, 48, 128]) {
    assert.equal(m.icons[String(size)], `icons/icon${size}.png`);
  }
});

test('every manifest icon file exists and matches its nominal pixel size', () => {
  const m = loadManifest();
  for (const [size, rel] of Object.entries(m.icons)) {
    const file = path.join(__dirname, '..', rel);
    assert.ok(fs.existsSync(file), `${rel} missing`);
    const buf = fs.readFileSync(file);
    // PNG: 8-byte signature, IHDR at 8; width big-endian at byte 16, height at 20.
    assert.equal(buf.readUInt32BE(16), Number(size), `${rel} width`);
    assert.equal(buf.readUInt32BE(20), Number(size), `${rel} height`);
  }
});
