const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');

test('backend loads Supabase credentials from the environment', () => {
  assert.match(server, /require\(['"]dotenv['"]\)\.config\(\)/);
  assert.match(server, /SUPABASE_URL/);
  assert.match(server, /SUPABASE_SECRET_KEY/);
  assert.match(server, /createClient/);
});

test('checkout persists a validated order in Supabase', () => {
  assert.match(server, /supabase\.from\(['"]orders['"]\)\.insert/);
  assert.match(server, /customer_name/);
  assert.match(server, /delivery_address/);
  assert.match(server, /if \(error\)/);
});

test('order lookup reads from Supabase and redacts delivery details', () => {
  assert.match(server, /\.from\(['"]orders['"]\)\s*\.select/);
  assert.match(server, /delivery: '\[redacted in response\]'/);
});
