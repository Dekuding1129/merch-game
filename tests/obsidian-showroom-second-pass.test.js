const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('second-pass showroom creates a framed illuminated lightbox', () => {
  assert.match(css, /\/\* Obsidian Showroom — second pass \*\//);
  assert.match(css, /\.viewer\s*\{[^}]*border:\s*10px solid #07090c/s);
  assert.match(css, /\.viewer\s*\{[^}]*inset 0 0 120px/s);
  assert.match(css, /\.viewer::before\s*\{[^}]*box-shadow:/s);
});

test('archive numbering and museum labeling add hierarchy', () => {
  assert.match(css, /\.stage-number\s*\{[^}]*display:\s*block/s);
  assert.match(css, /font-size:\s*clamp\(92px, 13vw, 210px\)/);
  assert.match(css, /\.stage-number::before/);
  assert.match(css, /content:\s*"ARCHIVE OBJECT"/);
});

test('gallery panels have metallic depth instead of flat black fills', () => {
  assert.match(css, /\.rail::before/);
  assert.match(css, /\.info::before/);
  assert.match(css, /linear-gradient\(90deg, transparent, rgb\(185 149 69 \/ \.5\), transparent\)/);
  assert.match(css, /\.select-item\.active\s*\{[^}]*box-shadow:/s);
});

test('product presentation receives a controlled spotlight and pedestal', () => {
  assert.match(css, /\.product-ground-shadow::before/);
  assert.match(css, /\.product-ground-shadow::after/);
  assert.match(css, /SHOWROOM BAY/);
  assert.match(css, /\.product\.has-3d\s*\{[^}]*filter:[^}]*drop-shadow/s);
});
