/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { mediaFraming, scenePose } = require('../lib/receiver/aura-state.ts');
const { compileAuthoredExperience } = require('../lib/studio/authoring.ts');
const { roomStudioConfigSchema, experienceDnaSchema } = require('../lib/studio/contracts.ts');

test('framing preserves text space and gracefully handles missing media dimensions', () => {
  assert.equal(mediaFraming('text', 100, 500), 'letter');
  assert.equal(mediaFraming('photo', 700, 1000), 'portrait');
  assert.equal(mediaFraming('video', 1920, 1080), 'landscape');
  assert.equal(mediaFraming('photo', 800, 800), 'square');
  assert.equal(mediaFraming('photo', null, null), 'landscape');
  assert.equal(scenePose(1, true, true).spread > scenePose(1, false, true).spread, true);
});

test('new compilation pins the renderer without silently upgrading stored snapshots', () => {
  const stamp = '2026-10-10T12:00:00.000Z';
  const studio = roomStudioConfigSchema.parse({ schemaVersion: 1, authoringVersion: 2, themeId: 'theme_warm_memory', selectedMedia: [], sectionPlan: [{ id: 'section_letter', type: 'text', mediaIds: [], order: 0, caption: 'Pesan asli.' }], storyAnchors: { opening: [], climax: [], ending: [] }, storyAnchorsConfirmed: true, backgroundMusic: null, directionCandidates: [], selectedDirectionId: null, updatedAt: stamp });
  const fresh = compileAuthoredExperience(studio, 'direction_fixture01', stamp);
  assert.equal(fresh.rendererVersion, 'rintik-resonansi-v2');
  assert.equal(fresh.sections[0].microCopy, 'Pesan asli.');
  const old = { ...fresh }; delete old.rendererVersion;
  assert.equal(experienceDnaSchema.parse(old).rendererVersion, undefined);
  assert.equal(experienceDnaSchema.safeParse({ ...fresh, rendererVersion: 'unknown' }).success, false);
  const resonance = compileAuthoredExperience({ ...studio, atmosphere: { world: 'resonance', intensity: 'balanced', response: 'energy', motion: 'soft', backgroundAura: true } }, 'direction_fixture02', stamp);
  assert.equal(resonance.atmosphere.world, 'resonance');
  assert.equal(resonance.sections[0].atmosphere.world, 'resonance');
});
