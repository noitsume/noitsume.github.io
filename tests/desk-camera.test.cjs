/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { sampleDeskCamera, DESK_CAMERA_DURATION } = require('../lib/dashboard/desk-camera.ts');
const { DESK_PREPARE_MS, DESK_FAILSAFE_MS } = require('../lib/dashboard/arrival.ts');

test('the first camera phase turns right without moving the viewer', () => {
  const start = sampleDeskCamera(0, 1.6);
  const turned = sampleDeskCamera(.3, 1.6);
  assert.deepEqual(start.position, turned.position);
  assert.ok(turned.target[0] > start.target[0] + 4);
});

test('after turning, the viewer approaches the workspace on wide and narrow screens', () => {
  for (const aspect of [.4, .75, 1, 1.6, 2.4]) {
    let previous = Infinity;
    for (let i = 30; i <= 100; i++) {
      const { position, target } = sampleDeskCamera(i / 100, aspect);
      const distance = Math.hypot(...position.map((n, j) => n - target[j]));
      assert.ok(position[1] > 2.5, 'camera clears the lamp and tabletop');
      assert.ok(distance <= previous + 1e-6, 'arrival must move closer, not zoom away');
      previous = distance;
    }
  }
});

test('camera clamps endpoints and has no jump at the turn/travel handoff', () => {
  assert.deepEqual(sampleDeskCamera(-1, 1), sampleDeskCamera(0, 1));
  assert.deepEqual(sampleDeskCamera(2, 1), sampleDeskCamera(1, 1));
  const before = sampleDeskCamera(.3 - .0001, 1.6);
  const after = sampleDeskCamera(.3 + .0001, 1.6);
  assert.ok(Math.hypot(...before.position.map((n, j) => n - after.position[j])) < .001);
  assert.ok(Math.hypot(...before.target.map((n, j) => n - after.target[j])) < .001);
  assert.ok(DESK_CAMERA_DURATION * 1000 + DESK_PREPARE_MS < DESK_FAILSAFE_MS, 'animation fits the cold-load failsafe');
});
