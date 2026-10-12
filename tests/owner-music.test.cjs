/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRetiredMusicDraft, roomStudioConfigSchema, studioSettingsRequestSchema } = require('../lib/studio/contracts.ts');
const { saveOwnedStudioSettings } = require('../lib/studio/service.ts');

const upload = { source: 'room-upload', musicId: 'room_music_owner1234' };
const catalog = { source: 'catalog', songId: 'song_afterglow' };
function studio(backgroundMusic) {
  return {
    schemaVersion: 1,
    selectedMedia: [{ mediaId: 'video-kept', order: 0, volume: .6, trimInSec: 2, trimOutSec: 12, loop: false, fit: 'contain' }],
    sectionPlan: [{ id: 'section_video_kept', type: 'video', mediaIds: ['video-kept'], order: 0 }],
    storyAnchors: { opening: ['video-kept'], climax: [], ending: [] },
    storyAnchorsConfirmed: true, themeId: 'theme_warm_memory', backgroundMusic,
    wishIntelligence: {}, directionCandidates: [], selectedDirectionId: null,
    updatedAt: '2026-10-09T01:02:03.000Z',
  };
}

test('settings accepts owner music and rejects retired catalog before any backend write', async () => {
  assert.equal(studioSettingsRequestSchema.safeParse(studio(upload)).success, true);
  assert.equal(studioSettingsRequestSchema.safeParse(studio(null)).success, true);
  assert.equal(studioSettingsRequestSchema.safeParse(studio(catalog)).success, false);
  await assert.rejects(saveOwnedStudioSettings('unused-owner', 'unused-room', studio(catalog)), error => error.name === 'ZodError');
});

test('retired stored draft retains media, trims, anchors, theme and version while clearing music and directions', () => {
  const stored = { ...studio(catalog), directionCandidates: [{ id: 'direction_legacy123', backgroundMusic: catalog }], selectedDirectionId: 'direction_legacy123' };
  const before = structuredClone(stored);
  const restored = roomStudioConfigSchema.parse(stored);
  assert.deepEqual(restored, { ...before, backgroundMusic: null, directionCandidates: [], selectedDirectionId: null });
  assert.deepEqual(stored, before, 'reading must not mutate persisted data');
});

test('owner upload survives stored draft reads unchanged', () => {
  assert.deepEqual(roomStudioConfigSchema.parse(studio(upload)), studio(upload));
});

test('old tab drafts retain unsaved choices and concurrency version when removing catalog music', () => {
  const pending = { ...studio(catalog), expectedStudioUpdatedAt: '2026-10-09T01:02:03.000Z' };
  const recovered = studioSettingsRequestSchema.parse(normalizeRetiredMusicDraft(pending));
  assert.equal(recovered.backgroundMusic, null);
  assert.deepEqual(recovered.selectedMedia, pending.selectedMedia);
  assert.deepEqual(recovered.storyAnchors, pending.storyAnchors);
  assert.equal(recovered.expectedStudioUpdatedAt, pending.expectedStudioUpdatedAt);
});
