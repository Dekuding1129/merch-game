const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('Void Chrome defines a near-black silver and violet material palette', () => {
  assert.match(css, /\/\* Void Chrome \*\//);
  assert.match(css, /--void-black:\s*#07080c/);
  assert.match(css, /--smoked-silver:\s*#aeb3be/);
  assert.match(css, /--violet-reflection:\s*#8875ff/);
});

test('the inspection chamber becomes smoked silver rather than ivory', () => {
  assert.match(css, /\.viewer\s*\{[^}]*#c7cad1[^}]*#8f949e/s);
  assert.match(css, /\.viewer\s*\{[^}]*inset 0 0 130px rgb\(16 18 27 \/ \.22\)/s);
  assert.match(css, /\.viewer::after\s*\{[^}]*color:\s*#5f52a8/s);
});

test('violet is restrained to reflected edges and active states', () => {
  assert.match(css, /\.topbar::after\s*\{[^}]*rgb\(136 117 255 \/ \.62\)/s);
  assert.match(css, /\.select-item\.active\s*\{[^}]*border-color:\s*var\(--violet-reflection\)/s);
  assert.match(css, /\.detail-hotspots button\[aria-pressed="true"\]\s*\{[^}]*border-color:\s*var\(--violet-reflection\)/s);
});

test('mobile header and all three orientation controls stay inside the viewport', () => {
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.detail-hotspots\s*\{[^}]*grid-template-columns:\s*repeat\(3, 40px\)[^}]*width:\s*136px/s);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.cart-button\s*\{[^}]*font-size:\s*0/s);
  assert.match(css, /\.cart-button::before\s*\{[^}]*content:\s*"INV"/s);
});

test('dark panels and mobile controls are fully carried into Void Chrome', () => {
  assert.match(css, /\.rail\s*\{[^}]*background-color:\s*#0b0d12/s);
  assert.match(css, /\.info\s*\{[^}]*background-color:\s*#0e1016/s);
  assert.match(css, /\.mobile-purchase-dock\s*\{[^}]*background:\s*rgb\(9 11 16 \/ \.97\)/s);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.rail::after\s*\{[^}]*#0b0d12/s);
});
