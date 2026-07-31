const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'hoodie-3d.js'), 'utf8');

function numericConstant(name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  assert.ok(match, `${name} must be declared as a numeric constant`);
  return Number(match[1]);
}

test('the hoodie GLB exposes a dedicated drawstring material', () => {
  const glb = fs.readFileSync(path.join(root, 'models', 'hoodie', 'virtual-pandora-hoodie.glb'));
  assert.ok(glb.includes(Buffer.from('Straps_FRONT')), 'hoodie asset must contain the drawstring mesh');
});

test('hoodie rotation drives independent bounded drawstring physics', () => {
  assert.match(source, /splitDrawstringMesh\(/);
  assert.match(source, /applyPhysicsImpulse\(angularVelocity\)/);
  assert.match(source, /drawstringStates/);
  assert.match(source, /requestAnimationFrame\(stepDrawstringPhysics\)/);
  assert.ok(numericConstant('drawstringSwingLimit') >= 0.12);
  assert.ok(numericConstant('drawstringSwingLimit') <= 0.28);
  assert.ok(numericConstant('drawstringImpulse') >= 0.01);
  assert.ok(numericConstant('drawstringImpulse') <= 0.05);
});

test('hoodie renderer exposes physics reset and inspection', () => {
  assert.match(source, /resetPhysics,/);
  assert.match(source, /getPhysicsState,/);
  assert.match(source, /applyPhysicsImpulse,/);
});
