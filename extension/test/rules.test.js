'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadRules() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8');
  return JSON.parse(raw);
}

test('rules.json is a JSON array with exactly one rule', () => {
  const rules = loadRules();
  assert.ok(Array.isArray(rules));
  assert.equal(rules.length, 1);
});

test('the rule removes both frame-blocking headers via modifyHeaders', () => {
  const [rule] = loadRules();
  assert.equal(rule.id, 1);
  assert.equal(rule.priority, 1);
  assert.equal(rule.action.type, 'modifyHeaders');
  const removed = rule.action.responseHeaders
    .filter((h) => h.operation === 'remove')
    .map((h) => h.header)
    .sort();
  assert.deepEqual(removed, ['content-security-policy', 'x-frame-options']);
});

test('the rule is scoped to sub_frame requests initiated by tuliplot.com and localhost', () => {
  const [rule] = loadRules();
  assert.deepEqual(rule.condition.resourceTypes, ['sub_frame']);
  assert.deepEqual(rule.condition.initiatorDomains, ['tuliplot.com', 'localhost']);
});
