const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const viewer = fs.readFileSync(path.join(__dirname, '..', 'js', 'viewer.js'), 'utf8');
const catalog = viewer.slice(viewer.indexOf('const products = ['), viewer.indexOf('const els = {'));

test('catalog contains only the four Mizrach Pinaz products', () => {
  assert.doesNotMatch(catalog, /Night Shift/);
  assert.doesNotMatch(catalog, /kind:\s*'jacket'/);
  assert.equal((catalog.match(/\bname:\s*'/g) || []).length, 4);
});
