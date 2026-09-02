const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const adapterPath = path.join(root, 'api', '[...path].js');

 test('Vercel catch-all adapter forwards requests to the existing backend app', () => {
  assert.equal(fs.existsSync(adapterPath), true);
  const adapter = fs.readFileSync(adapterPath, 'utf8');
  assert.match(adapter, /createApp/);
  assert.match(adapter, /emit\(['"]request['"]/);
});

test('frontend uses the same HTTPS origin for deployed API calls', () => {
  const viewer = fs.readFileSync(path.join(root, 'js', 'viewer.js'), 'utf8');
  const payment = fs.readFileSync(path.join(root, 'test-payment.html'), 'utf8');
  for (const source of [viewer, payment]) {
    assert.match(source, /location\.origin/);
    assert.match(source, /localhost/);
  }
});
