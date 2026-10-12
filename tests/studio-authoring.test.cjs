/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { roomStudioConfigSchema, defaultSceneAtmosphere } = require('../lib/studio/contracts.ts');
const { emptySection, sectionProblems, upgradeStudioAuthoring, compileAuthoredExperience } = require('../lib/studio/authoring.ts');
const { buildStudioSectionPlan } = require('../lib/studio/section-plan.ts');
const { saveOwnedStudioSettings, getRoomStudioConfig, deleteOwnedRoomMusic, startOwnedStudio, saveOwnedRoomMusicAnalysis, saveOwnedVideoBeatmap } = require('../lib/studio/service.ts');
const { extractAudioFeatures } = require('../lib/audio/extract.ts');
const { previewOwnedReceiver, bakeOwnedReceiver } = require('../lib/receiver/service.ts');
const { soundtrackGains, smoothAccent } = require('../lib/receiver/playback.ts');
const { backendRepositories: repos } = require('../lib/data/providers/backend-repository-provider.ts');
const storage = require('../lib/storage/b2.ts');
const version = '2026-10-10T12:00:00.000Z';
const selection = id => ({ source: 'room-upload', musicId: id });
const setting = (mediaId, order = 0) => ({ mediaId, order, volume: 1, trimInSec: null, trimOutSec: null, loop: false, fit: 'contain' });
function draft(extra = {}) { return roomStudioConfigSchema.parse({ schemaVersion: 1, authoringVersion: 2, atmosphere: defaultSceneAtmosphere, selectedMedia: [], sectionPlan: [], storyAnchors: { opening: [], climax: [], ending: [] }, storyAnchorsConfirmed: true, themeId: 'theme_warm_memory', backgroundMusic: null, directionCandidates: [], selectedDirectionId: null, updatedAt: version, ...extra }); }
function section(type, ids = [], extra = {}) { return { ...emptySection(type, 'section_' + type.replace('-', '_'), 0), mediaIds: ids, ...extra }; }
function setup(studio = draft()) {
  let room = { id: 'room', ownerUid: 'owner', title: 'Cerita kami', recipientName: 'Sahabat', occasionId: 'birthday', themeId: 'theme_warm_memory', status: 'configuring', receiverId: null, config: { studio }, updatedAt: version };
  const media = ['photo-a', 'photo-b', 'video-a', 'video-b'].map((id, index) => ({ id, roomId: 'room', source: 'owner', type: index < 2 ? 'photo' : 'video', storageObjectKey: `rooms/room/media/${id}`, contentType: index < 2 ? 'image/png' : 'video/mp4', sizeBytes: 100, originalFileName: id, durationSec: index < 2 ? undefined : 12 }));
  const music = ['room_music_bg123456', 'room_music_front1234'].map(id => ({ id, roomId: 'room', name: id, sizeBytes: 100, track: { id: id + '-track', source: 'b2', storageObjectKey: `rooms/room/music/${id}.mp3`, contentType: 'audio/mpeg' }, beatmap: null, analysis: { status: 'ready', bpm: 100, durationSec: 30, beats: [0, .6, 1.2], onsets: [0], energyCurve: [.2, .6, .3], mood: ['warm'] } }));
  const writes = [], deleted = [];
  repos.rooms.getRoom = async () => room;
  repos.rooms.setStatus = async (_id, status, updatedAt) => { room = { ...room, status, updatedAt }; };
  repos.rooms.setConfig = async (_id, config, updatedAt, expected) => { assert.deepEqual(expected, room.config); room = { ...room, themeId: config.studio.themeId, config, updatedAt }; };
  repos.media.listByRoom = async () => media;
  repos.media.getById = async (_roomId, id) => media.find(item => item.id === id) ?? null;
  repos.media.updateAudioBeatmap = async (_roomId, id, beatmap) => { media.find(item => item.id === id).audioBeatmap = beatmap; };
  repos.submissions.listByRoom = async () => [];
  repos.roomMusic.getById = async (_roomId, id) => music.find(track => track.id === id) ?? null;
  repos.roomMusic.updateAnalysis = async (_roomId, id, updated) => { music[music.findIndex(track => track.id === id)] = updated; };
  repos.roomMusic.delete = async (_roomId, id) => deleted.push(id);
  repos.receivers.getManifest = async () => null;
  repos.receivers.publishSnapshot = async input => { writes.push(input); return { ...input.manifest, revision: 1, bakedAt: input.bakedAt }; };
  storage.createPrivateDownloadUrl = async ({ objectKey }) => 'https://storage.invalid/' + objectKey;
  storage.headPrivateObject = async () => ({ ContentLength: 100 });
  storage.writePrivateJson = async (key, body) => writes.push({ key, body });
  storage.deletePrivateObjects = async keys => deleted.push(...keys);
  storage.deletePrivatePrefixCompletely = async prefix => deleted.push(prefix);
  return { room: () => room, media, music, writes, deleted };
}

test('new drafts stay empty after selecting moments; incomplete sections persist but cannot preview', async () => {
  setup();
  const first = await saveOwnedStudioSettings('owner', 'room', { ...draft(), selectedMedia: [setting('photo-a')], expectedStudioUpdatedAt: version });
  assert.deepEqual(first.studio.sectionPlan, []);
  const second = await saveOwnedStudioSettings('owner', 'room', { ...first.studio, sectionPlan: [section('photo')], expectedStudioUpdatedAt: first.studio.updatedAt });
  assert.equal(second.studio.sectionPlan.length, 1);
  await assert.rejects(saveOwnedStudioSettings('owner', 'room', { ...second.studio, preparePreview: true }), { code: 'SECTION_INVALID' });
});

test('v2 audio artifacts remain immutable through reanalysis, preview and publication; video data stays outside Firestore', async () => {
  const state = setup();
  Object.assign(state.music[0], { schemaVersion: 1, originalFileName: 'soundtrack.mp3', createdAt: version, updatedAt: version });
  const input = extractAudioFeatures([new Float32Array(22050)], 22050, 'a'.repeat(64));
  const first = await saveOwnedRoomMusicAnalysis('owner', 'room', state.music[0].id, input);
  const originalKey = first.music.beatmap.storageObjectKey;
  assert.equal(first.music.analysis.version, 'music-v2');
  assert.equal(first.music.analysis.features, undefined);
  assert.equal(state.writes.at(-1).body.features.spectrum.bands, 16);
  await saveOwnedVideoBeatmap('owner', 'room', 'video-a', input);
  const video = state.media.find(item => item.id === 'video-a');
  assert.deepEqual(Object.keys(video.audioBeatmap).sort(), ['durationSec', 'hash', 'storageObjectKey', 'version']);
  await assert.rejects(saveOwnedVideoBeatmap('intruder', 'room', 'video-a', input));
  await assert.rejects(saveOwnedVideoBeatmap('owner', 'room', 'photo-a', input), { code: 'MEDIA_NOT_FOUND' });
  await assert.rejects(saveOwnedRoomMusicAnalysis('owner', 'room', state.music[0].id, { ...input, hash: 'b'.repeat(64) }), { code: 'MUSIC_ANALYSIS_INVALID' });
  await saveOwnedStudioSettings('owner', 'room', { ...draft({ backgroundMusic: selection(state.music[0].id), selectedMedia: [setting('video-a')], sectionPlan: [section('video', ['video-a'])] }), preparePreview: true });
  const preparedWrites = state.writes.length;
  const preview = await previewOwnedReceiver('owner', 'room');
  assert.equal(preview.manifest.music.beatmapSource, 'asset');
  assert.ok(preview.manifest.media[0].audioBeatmapAssetId);
  assert.equal(state.writes.length, preparedWrites, 'preview reuses prepared v2 assets');
  const published = await bakeOwnedReceiver('owner', 'room');
  assert.equal(published.manifest.music.beatmapAssetId, preview.manifest.music.beatmapAssetId);
  assert.equal(published.manifest.media[0].audioBeatmapAssetId, preview.manifest.media[0].audioBeatmapAssetId);
  const next = { ...input, features: { ...input.features, beatQuality: .5 } };
  const updated = await saveOwnedRoomMusicAnalysis('owner', 'room', state.music[0].id, next);
  assert.notEqual(updated.music.beatmap.storageObjectKey, originalKey);
  assert.ok(state.writes.some(write => write.key === originalKey), 'the previous immutable artifact is retained');
  assert.equal(state.deleted.length, 0);
});
test('section validation rejects wrong media, six-item sliders, duplicate identity and empty text; allows repeated spotlights', () => {
  const media = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, type: 'photo' }));
  const selectedMedia = media.map(item => setting(item.id));
  for (const plan of [[section('video', ['p0'])], [section('photo-slide', media.map(item => item.id))], [section('photo', ['foreign'])], [section('text')], [section('photo', ['p0']), section('photo', ['p1'])]]) {
    assert.ok(sectionProblems({ selectedMedia, sectionPlan: plan }, media).length);
  }
  assert.deepEqual(sectionProblems({ selectedMedia, sectionPlan: [section('photo', ['p0']), section('photo', ['p0'], { id: 'section_another', order: 1 })] }, media), []);
});
test('recommendation keeps chronological order, splits photo sliders at five and never mutates the selection', () => {
  const media = Array.from({ length: 13 }, (_, i) => ({ id: 'm' + i, type: i === 6 ? 'video' : 'photo' }));
  const settings = media.map((item, i) => setting(item.id, i)); const before = structuredClone(settings);
  const plan = buildStudioSectionPlan(settings, media);
  assert.deepEqual(plan.flatMap(item => item.mediaIds), media.map(item => item.id));
  assert.ok(plan.every(item => item.mediaIds.length <= 5));
  assert.deepEqual(settings, before);
});
test('legacy migration retains caption, explicit direction order and every photo while splitting large albums', () => {
  const original = draft({ selectedMedia: Array.from({ length: 8 }, (_, i) => setting('p' + i, i)), sectionPlan: [section('photo-slide', Array.from({ length: 8 }, (_, i) => 'p' + i))] });
  delete original.authoringVersion;
  const upgraded = upgradeStudioAuthoring(original);
  assert.equal(upgraded.sectionPlan.length, 2); assert.equal(upgraded.sectionPlan[0].mediaIds.length, 5);
  assert.deepEqual(upgraded.sectionPlan.flatMap(item => item.mediaIds), original.sectionPlan[0].mediaIds);
  assert.equal(original.sectionPlan.length, 1);
  const compiled = compileAuthoredExperience(draft({ sectionPlan: [section('text', [], { caption: 'Kalimat milik pemilik, tidak boleh diganti.' })] }), 'direction_test1234', version);
  const legacy = { ...original, selectedDirectionId: compiled.id, directionCandidates: [compiled] };
  assert.equal(upgradeStudioAuthoring(legacy).sectionPlan[0].caption, compiled.sections[0].microCopy);
});
test('save → preview → publication shares exact sections, captions, music and independent atmosphere; unassigned media stays private', async () => {
  const state = setup();
  const input = draft({
    selectedMedia: state.media.map((item, index) => setting(item.id, index)),
    backgroundMusic: selection(state.music[0].id),
    sectionPlan: [section('text', [], { title: 'Pembuka', caption: 'Kita, sekali lagi.' }), section('video-slide', ['video-b', 'video-a'], { order: 1, caption: 'Tawa kita.\nMasih sama.', music: selection(state.music[1].id), atmosphere: { intensity: 'lively', response: 'beat', motion: 'watermill', backgroundAura: false } }), section('photo', ['photo-a'], { order: 2, caption: 'Di sini kita pulang.' })],
  });
  const saved = await saveOwnedStudioSettings('owner', 'room', { ...input, preparePreview: true });
  assert.equal(getRoomStudioConfig(state.room()).sectionPlan.length, 3);
  const preview = await previewOwnedReceiver('owner', 'room');
  assert.equal(state.writes.length, 0, 'preview must not publish or write B2');
  const published = await bakeOwnedReceiver('owner', 'room');
  assert.deepEqual(published.manifest.experience, preview.manifest.experience);
  assert.deepEqual(published.manifest.experience.sections.map(item => item.microCopy), input.sectionPlan.map(item => item.caption));
  assert.deepEqual(published.manifest.experience.sections[1].mediaIds, ['video-b', 'video-a']);
  assert.equal(published.manifest.media.some(item => item.id === 'photo-b'), false);
  assert.equal(saved.studio.selectedMedia.length, 4, 'unassigned media remains in draft');
  assert.equal(Object.keys(published.manifest.sectionMusic).length, 1);
  assert.equal(published.manifest.music.beatmapSource, 'asset');
  assert.equal(published.manifest.sectionMusic[state.music[1].id].beatmapSource, 'asset');
  assert.equal(state.writes.filter(write => write.key).length, 2, 'beatmaps live outside Firestore manifest');
  assert.equal(published.manifest.assets.filter(asset => asset.kind === 'music').length, 2);
});
test('text-only story with no music previews and publishes; no AI or obligatory soundtrack', async () => {
  const state = setup(); state.room().status = 'closed'; repos.media.listByRoom = async () => [];
  assert.equal((await startOwnedStudio('owner', 'room')).status, 'configuring');
  await saveOwnedStudioSettings('owner', 'room', { ...draft({ sectionPlan: [section('text', [], { caption: 'Terima kasih sudah ada.' })] }), preparePreview: true });
  const { manifest } = await bakeOwnedReceiver('owner', 'room');
  assert.equal(manifest.music, null); assert.deepEqual(manifest.media, []); assert.equal(manifest.experience.sections[0].type, 'text');
});
test('reusing the soundtrack for section music publishes only one track and one immutable beatmap', async () => {
  const state = setup(); const music = selection(state.music[0].id);
  await saveOwnedStudioSettings('owner', 'room', { ...draft({ backgroundMusic: music, sectionPlan: [section('text', [], { caption: 'Suara yang sama.', music })] }), preparePreview: true });
  const { manifest } = await bakeOwnedReceiver('owner', 'room');
  assert.equal(manifest.assets.filter(asset => asset.kind === 'music').length, 1);
  assert.equal(manifest.assets.filter(asset => asset.kind === 'beatmap').length, 1);
  assert.equal(manifest.music.trackAssetId, manifest.sectionMusic[music.musicId].trackAssetId);
});
test('section music cannot belong to another Room or be pending; music referenced only by a section cannot be deleted', async () => {
  const state = setup();
  const base = draft({ sectionPlan: [section('text', [], { caption: 'Halo', music: selection('room_music_foreign12') })] });
  await assert.rejects(saveOwnedStudioSettings('owner', 'room', base), { code: 'ROOM_MUSIC_NOT_FOUND' });
  base.sectionPlan[0].music = selection(state.music[1].id); state.music[1].analysis.status = 'pending';
  await assert.rejects(saveOwnedStudioSettings('owner', 'room', base), { code: 'ROOM_MUSIC_NOT_ANALYZED' });
  state.music[1].analysis.status = 'ready'; await saveOwnedStudioSettings('owner', 'room', base);
  await assert.rejects(deleteOwnedRoomMusic('owner', 'room', state.music[1].id), { code: 'MUSIC_IN_USE' });
  assert.equal(state.deleted.length, 0);
  await assert.rejects(saveOwnedStudioSettings('intruder', 'room', base), { code: 'ROOM_FORBIDDEN' });
});
test('audio priority follows actual playback; smoothed accents cannot jump with a single beat', () => {
  const silent = soundtrackGains(.72, .22, -8, 0, false);
  const music = soundtrackGains(.72, .22, -8, 0, true);
  const video = soundtrackGains(.72, .22, -8, .1, true);
  assert.equal(silent.background, .72); assert.ok(music.background < music.section);
  assert.ok(video.background < .1 && video.section < .1);
  assert.ok(smoothAccent(0, 1, .032) < .15); assert.ok(smoothAccent(1, 0, .032) > .8);
});

test('owner music volumes survive save, reload, preview and publication independently', async () => {
  const state = setup();
  const saved = await saveOwnedStudioSettings('owner', 'room', {
    ...draft({ backgroundMusic: { ...selection(state.music[0].id), volume: .35 }, sectionPlan: [
      section('text', [], { caption: 'Buka perlahan.', music: { ...selection(state.music[1].id), volume: .7 } }),
      section('text', [], { id: 'section_quiet', caption: 'Satu menit hening.', order: 1, music: { ...selection(state.music[0].id), volume: 0 } }),
    ] }), preparePreview: true,
  });
  const reloaded = getRoomStudioConfig(state.room());
  assert.equal(reloaded.backgroundMusic.volume, .35);
  assert.equal(reloaded.sectionPlan[0].music.volume, .7);
  assert.equal(reloaded.sectionPlan[1].music.volume, 0);
  const preview = await previewOwnedReceiver('owner', 'room');
  const published = await bakeOwnedReceiver('owner', 'room');
  assert.equal(saved.studio.backgroundMusic.volume, .35);
  assert.equal(preview.manifest.experience.backgroundMusic.volume, .35);
  assert.equal(published.manifest.experience.sections[0].music.volume, .7);
  assert.equal(published.manifest.experience.sections[1].music.volume, 0);
  assert.equal(published.manifest.assets.filter(asset => asset.kind === 'music').length, 2);
});

test('volume changes preserve audio priority; a silent section must not duck background', () => {
  const baseline = soundtrackGains(.72, .22, -8, 0, false);
  const quiet = soundtrackGains(.72, .22, -8, 0, false, false, .25, .5);
  assert.equal(quiet.background, baseline.background * .25);
  assert.equal(quiet.section, baseline.section * .5);
  const silentSection = soundtrackGains(.72, .22, -8, 0, true, false, .5, 0);
  assert.equal(silentSection.background, .36); assert.equal(silentSection.section, 0);
  const bothMuted = soundtrackGains(.72, .22, -8, .5, true, false, 0, 0);
  assert.deepEqual(bothMuted, { background: 0, section: 0 });
  const foreground = soundtrackGains(.72, .22, -8, .08, true, false, .5, .3);
  assert.ok(foreground.background < .08 && foreground.section < .08);
  assert.throws(() => draft({ backgroundMusic: { ...selection('room_music_bg123456'), volume: 1.1 } }));
  assert.throws(() => draft({ sectionPlan: [section('text', [], { music: { ...selection('room_music_bg123456'), volume: -1 } })] }));
});
