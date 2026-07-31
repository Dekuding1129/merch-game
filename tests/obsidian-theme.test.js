const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('Obsidian Showroom palette is defined', () => {
  assert.match(css, /--obsidian:\s*#090b0f/);
  assert.match(css, /--showroom-ivory:\s*#eeeae0/);
  assert.match(css, /--coordinate-gold:\s*#b99545/);
  assert.match(css, /--gallery-line:\s*#292d33/);
});

test('gallery shell is dark while the inspection bay remains ivory', () => {
  assert.match(css, /\/\* Obsidian Showroom \*\//);
  assert.match(css, /\.topbar\s*\{[^}]*background:\s*rgb\(12 15 20 \/ \.92\)/s);
  assert.match(css, /\.rail\s*\{[^}]*background:\s*#0d1015/s);
  assert.match(css, /\.info\s*\{[^}]*background:\s*#11151a/s);
  assert.match(css, /\.viewer\s*\{[^}]*--ink:\s*#181a1d[^}]*background:/s);
});

test('inspection bay includes restrained gold coordinate detail', () => {
  assert.match(css, /\.viewer::after/);
  assert.match(css, /X 148\.22 \/ Y 09\.04 · BAY 01/);
  assert.match(css, /rgb\(185 149 69 \/ \.11\)/);
  assert.match(css, /\.select-item\.active\s*\{[^}]*border-color:\s*var\(--coordinate-gold\)/s);
});

test('forms, dialogs, and mobile dock remain readable', () => {
  assert.match(css, /\.info select\s*\{[^}]*color:\s*#f0eee8/s);
  assert.match(css, /\.product-detail-button\s*\{[^}]*background:\s*var\(--showroom-ivory\)/s);
  assert.match(css, /\.product-detail-dialog\s*\{[^}]*background:\s*#0d1015/s);
  assert.match(css, /\.detail-copy\s*\{[^}]*background:\s*var\(--showroom-ivory\)/s);
  assert.match(css, /\.mobile-purchase-dock\s*\{[^}]*background:\s*rgb\(12 15 20 \/ \.96\)/s);
});
