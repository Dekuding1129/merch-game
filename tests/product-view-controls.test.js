const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'viewer.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('stage buttons declare top, side, and bottom product views', () => {
  assert.match(html, /data-view="top"[^>]*><span>01<\/span> Top/);
  assert.match(html, /data-view="side"[^>]*><span>02<\/span> Side/);
  assert.match(html, /data-view="bottom"[^>]*><span>03<\/span> Bottom/);
});

test('pressing a stage button snaps the product orientation instead of opening details', () => {
  assert.match(js, /function moveProductToView\(view\)/);
  assert.match(js, /const PRODUCT_VIEW_ANGLES\s*=\s*\{/);
  assert.match(js, /top:\s*\{\s*x:\s*42,\s*y:\s*0\s*\}/);
  assert.match(js, /side:\s*\{\s*x:\s*0,\s*y:\s*90\s*\}/);
  assert.match(js, /bottom:\s*\{\s*x:\s*-52,\s*y:\s*0\s*\}/);
  assert.match(js, /els\.detailHotspots\.addEventListener\('click',[\s\S]*moveProductToView\(button\.dataset\.view\)/);
  assert.doesNotMatch(js, /els\.detailHotspots\.addEventListener\('click',[\s\S]{0,220}openDetailMode/);
});

test('real pointer presses on view controls do not start viewer dragging', () => {
  assert.match(js, /els\.detailHotspots\.addEventListener\('pointerdown', event => event\.stopPropagation\(\)\)/);
  assert.match(css, /\.detail-hotspots\s*\{[^}]*touch-action:\s*manipulation/s);
});

test('view snapping is smooth, interruptible, and exposes the selected view', () => {
  assert.match(js, /orientation\.slerpQuaternions\(snapStartOrientation, snapTargetOrientation, eased\)/);
  assert.match(js, /function stopViewSnap\(\)/);
  assert.match(js, /els\.viewer\.dataset\.view\s*=\s*view/);
  assert.match(js, /button\.setAttribute\('aria-pressed', String\(button\.dataset\.view === view\)\)/);
  assert.match(css, /\.detail-hotspots button\[aria-pressed="true"\]/);
});
