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

test('every catalog product has an explicit price', () => {
  for (const [name, price] of [
    ['Mizrach Pinaz T-Shirt', 42],
    ['Mizrach Pinaz Tumbler', 28],
    ['Mizrach Pinaz Hoodie', 68],
    ['Mizrach Pinaz Keychain', 18]
  ]) {
    assert.match(catalog, new RegExp(`name: '${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}'[^\\n]*price: ${price}\\b`));
  }
  assert.doesNotMatch(catalog, /price:\s*null/);
});
