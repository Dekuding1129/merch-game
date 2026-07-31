const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'keychain-3d.js'), 'utf8');

function numericConstant(name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`));
  assert.ok(match, `${name} must be declared as a numeric constant`);
  return Number(match[1]);
}

test('holding and moving the metal ring gives the chain a controlled articulated swing', () => {
  assert.ok(numericConstant('chainSwingLimitBase') >= 0.16, 'base swing must remain visible');
  assert.ok(numericConstant('chainSwingLimitBase') <= 0.2, 'base swing must stay restrained');
  assert.ok(numericConstant('chainSwingLimitStep') >= 0.02, 'lower links must retain extra travel');
  assert.ok(numericConstant('chainSwingLimitStep') <= 0.035, 'lower-link travel must stay restrained');
  assert.ok(numericConstant('handleChainImpulse') >= 0.018, 'ring motion must drive the chain');
  assert.ok(numericConstant('handleChainImpulse') <= 0.03, 'ring impulse must be low sensitivity');
  assert.ok(numericConstant('handleDisplacementResponse') >= 0.22, 'direct movement must remain responsive');
  assert.ok(numericConstant('handleDisplacementResponse') <= 0.32, 'direct movement sensitivity must be low');
  assert.match(source, /applyHandleSwingImpulse\(displacementX, displacementY, handleVelocity\)/);
});

test('direct metal-ring dragging works even when ambient motion is reduced', () => {
  const viewerSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'viewer.js'), 'utf8');
  const grabBlock = viewerSource.match(/const grabbedHandle =[^;]+;/s)?.[0] || '';
  assert.ok(grabBlock.includes('beginHandleDrag'), 'viewer must attempt the ring interaction');
  assert.ok(!grabBlock.includes('physicsAllowed'), 'reduced-motion must not disable direct manipulation');
});

test('wide chain motion remains damped and bounded', () => {
  assert.ok(numericConstant('chainSwingDamping') >= 2);
  assert.ok(numericConstant('chainSwingDamping') <= 4.5);
  assert.match(source, /THREE\.MathUtils\.clamp\(state\.angleZ, -limit, limit\)/);
  assert.match(source, /THREE\.MathUtils\.clamp\(state\.angleX, -limit, limit\)/);
});
