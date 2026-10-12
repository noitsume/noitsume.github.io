/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { sampleDeskDayCycle, DAY_CYCLE_COMMIT, DAY_CYCLE_DURATION } = require('../lib/dashboard/day-cycle.ts');

test('theme changes only behind full darkness, before any new light is revealed', () => {
  for (const mode of ['light', 'dark']) {
    for (const time of [.7, DAY_CYCLE_COMMIT, 1.02]) {
      const frame = sampleDeskDayCycle(time, mode);
      assert.equal(frame.cover, 1);
      assert.equal(frame.spread, 0);
      assert.equal(frame.day + frame.night, 0);
      assert.equal(frame.ui, 0);
    }
    assert.equal(sampleDeskDayCycle(DAY_CYCLE_COMMIT - .001, mode).committed, false);
    assert.equal(sampleDeskDayCycle(DAY_CYCLE_COMMIT, mode).committed, true);
  }
});

test('sunrise and nightfall finish with one light source, usable UI, and no curtain', () => {
  for (const mode of ['light', 'dark']) {
    const end = sampleDeskDayCycle(DAY_CYCLE_DURATION[mode], mode);
    assert.equal(end.day, mode === 'light' ? 1 : 0);
    assert.equal(end.night, mode === 'dark' ? 1 : 0);
    assert.equal(end.ui, 1);
    assert.equal(end.cover, 0);
    assert.equal(end.glow, 0);
    assert.equal(end.spread, 1);
  }
});

test('the light spreads continuously and precedes the returning panels', () => {
  for (const mode of ['light', 'dark']) {
    let previous = 0;
    for (let time = 1.02; time <= DAY_CYCLE_DURATION[mode]; time += .005) {
      const frame = sampleDeskDayCycle(time, mode);
      assert.ok(frame.spread >= previous);
      assert.ok(frame.spread - previous < .01, 'no jumping edge or flash');
      if (frame.ui > 0) assert.ok(frame.spread > .7, 'room is lit before its panels return');
      for (const key of ['day', 'night', 'cover', 'ui', 'glow']) assert.ok(frame[key] >= 0 && frame[key] <= 1);
      previous = frame.spread;
    }
  }
});
