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

test('available purchase controls are labeled BUY', () => {
  assert.match(viewer, /els\.mobileDockAction\.textContent = available \? 'BUY' : 'Notify me'/);
  assert.match(viewer, /els\.equip\.textContent = available \? 'BUY' : 'Notify me'/);
});

test('BUY opens a required delivery-details form without local persistence', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /id="deliveryForm"/);
  for (const field of ['name', 'email', 'phone', 'address', 'city', 'postal', 'country']) {
    assert.match(index, new RegExp(`name="${field}"[^>]*required`));
  }
  assert.match(viewer, /openDeliveryForm\(\)/);
  assert.match(viewer, /Object\.fromEntries\(new FormData\(els\.deliveryForm\)\.entries\(\)\)/);
  assert.doesNotMatch(viewer, /localStorage\.setItem\([^)]*delivery/);
});

test('delivery submission uses the demo backend before adding inventory', () => {
  assert.match(viewer, /fetch\(`\$\{apiBase\}\/api\/checkout\/quote`/);
  assert.match(viewer, /payments disabled|No payment taken/i);
  assert.match(viewer, /if \(!response\.ok\)/);
});

test('keyboard product shortcuts do not interfere with text entry', () => {
  assert.match(viewer, /e\.target\.matches\('input, textarea, select, button, \[contenteditable="true"\]'\)/);
});

test('delivery form starts with country and supports browser autofill', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /id="deliveryCountry"[^>]*autocomplete="country-name"/);
  assert.match(index, /id="deliveryCountry"[\s\S]*<option value="" selected><\/option>/);
  assert.match(index, /autocomplete="name"/);
  assert.match(index, /autocomplete="street-address"/);
});

test('location fields use dependent dropdowns', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /id="deliveryRegion"[^>]*disabled/);
  assert.doesNotMatch(index, /id="deliveryCity"[^>]*disabled/);
  assert.doesNotMatch(index, /id="deliveryPostal"[^>]*disabled/);
  assert.match(index, /list="deliveryCityOptions"/);
  assert.match(viewer, /updateDeliveryRegions\(\)/);
  assert.match(viewer, /updateDeliveryCities\(\)/);
  assert.match(viewer, /updateDeliveryPostal\(\)/);
  assert.match(viewer, /fetch\('data\/geodata\.json'\)/);
  assert.match(viewer, /getLocationData\(\)/);
  assert.match(viewer, /data\.regions/);
  assert.match(viewer, /data\.cities/);
  assert.match(viewer, /data\.postal/);
});

test('city and postal fields remain writable with dropdown suggestions', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /id="deliveryCity"[^>]*list="deliveryCityOptions"/);
  assert.match(index, /id="deliveryPostal"[^>]*list="deliveryPostalOptions"/);
  assert.match(viewer, /els\.deliveryPostal\.disabled = false/);
});

test('location controls do not show instructional placeholder text', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /id="deliveryCountry"[^>]*list="deliveryCountryOptions"/);
  assert.match(index, /id="deliveryCity"[^>]*placeholder=""/);
  assert.match(index, /id="deliveryPostal"[^>]*placeholder=""/);
  assert.match(viewer, /deliveryCountryOptions\.innerHTML = data\.countries/);
});

test('city and postal inputs stay writable before dependent suggestions load', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(index, /id="deliveryCity"[^>]*disabled/);
  assert.doesNotMatch(index, /id="deliveryPostal"[^>]*disabled/);
  assert.match(viewer, /els\.deliveryCity\.disabled = false/);
});

test('country is a writable input with country suggestions', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /id="deliveryCountry"[^>]*list="deliveryCountryOptions"/);
  assert.match(index, /id="deliveryCountryOptions"/);
  assert.match(viewer, /deliveryCountryOptions\.innerHTML = data\.countries/);
  assert.match(viewer, /function countryCode\(data\)/);
});
