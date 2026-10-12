/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../lib/data/firestore/shared.ts');
const { FirestoreSubmissionRepository } = require('../lib/data/firestore/firestore-submission-repository.ts');
const { backendRepositories: repos } = require('../lib/data/providers/backend-repository-provider.ts');
const { submissionSchema, mediaSchema } = require('../lib/data/contracts/index.ts');
const { ownerSubmissionActionSchema } = require('../lib/collector/schemas.ts');
const b2 = require('../lib/storage/b2.ts');
const { moderateOwnedSubmissions } = require('../lib/collector/service.ts');
const now = '2026-10-10T12:00:00.000Z';

// Transactional in-memory adapter. Production repository/service code runs with
// isolated Firestore and versioned B2 doubles; no real customer files are touched.
function setup({ legacy = false, message = 'Semoga selalu bahagia' } = {}) {
  const stagedMedia = ['photo', 'video', 'other'].map((id, index) => ({ id, type: index === 1 ? 'video' : 'photo', storageObjectKey: `rooms/room/submissions/sub/${id}.${index === 1 ? 'mp4' : 'png'}`, originalFileName: `${id}.${index === 1 ? 'mp4' : 'png'}`, contentType: index === 1 ? 'video/mp4' : 'image/png', sizeBytes: 100 + index }));
  const sub = submissionSchema.parse({ id: 'sub', roomId: 'room', source: 'contributor', status: 'new', mediaIds: legacy ? stagedMedia.map(item => item.id) : [], stagedMedia: legacy ? [] : stagedMedia, contributorName: 'Teman', message, submittedAt: now, reviewedAt: null });
  const docs = new Map([['rooms/room', { id: 'room', ownerUid: 'owner', config: {} }], ['rooms/room/submissions/sub', sub]]);
  if (legacy) for (const item of stagedMedia) docs.set('rooms/room/media/' + item.id, mediaSchema.parse({ ...item, roomId: 'room', submissionId: 'sub', message, contributorName: 'Teman', source: 'contributor', uploaderUid: null, submittedAt: now }));
  let pending = Promise.resolve();
  const controls = { failCommit: false, failCleanup: false, failPromotion: false };
  function ref(path) { return { path, id: path.split('/').pop(), collection: name => ({ path: path + '/' + name, query: true, doc: id => ref(path + '/' + name + '/' + id), get: async () => snapshot({ path: path + '/' + name, query: true }) }), get: async () => snapshot(ref(path)) }; }
  function snapshot(r) { if (r.query) { const children = [...docs.keys()].filter(key => key.startsWith(r.path + '/') && key.split('/').length === r.path.split('/').length + 1).map(key => snapshot(ref(key))); return { docs: children, size: children.length }; } return { id: r.id, exists: docs.has(r.path), data: () => docs.get(r.path) }; }
  const db = { collection: name => ({ doc: id => ref(name + '/' + id) }), runTransaction: callback => {
    const result = pending.then(async () => {
      const writes = [];
      const tx = { get: async r => snapshot(r), update: (r, value) => writes.push([r.path, { ...docs.get(r.path), ...value }]), set: (r, value) => writes.push([r.path, value]), delete: r => writes.push([r.path, null]) };
      const result = await callback(tx);
      if (controls.failCommit && writes.some(([path, value]) => path.endsWith('/sub') && value?.status !== 'new')) { controls.failCommit = false; throw Error('Firestore interrupted'); }
      for (const [path, value] of writes) { if (value === null) docs.delete(path); else docs.set(path, value); }
      return result;
    }); pending = result.catch(() => {}); return result;
  } };
  shared.firestoreDb = () => db;
  repos.rooms.getRoom = async () => docs.get('rooms/room');
  repos.submissions = new FirestoreSubmissionRepository();
  repos.media.listByRoom = async () => [...docs].filter(([path]) => path.startsWith('rooms/room/media/')).map(([, value]) => ({ ...value, submittedAt: now }));
  const versions = new Map(stagedMedia.map(item => [item.storageObjectKey, ['old-version', 'current-version']]));
  // Simulate an orphan copy from the former whole-submission approval flow.
  versions.set('rooms/room/media/other.png', ['orphan-old', 'orphan-new']);
  versions.set('rooms/another-room/media/photo.png', ['untouched']);
  const calls = [];
  b2.promotePrivateObject = async ({ sourceKey, destinationKey }) => { calls.push(['promote', sourceKey, destinationKey]); if (controls.failPromotion) throw Error('B2 copy failed'); if (!versions.has(destinationKey)) { assert.ok(versions.has(sourceKey), 'source or verified destination must exist'); versions.set(destinationKey, ['accepted-copy']); } };
  b2.deletePrivateObjects = async keys => { calls.push(['delete', keys]); if (controls.failCleanup) throw Error('B2 unavailable'); keys.forEach(key => versions.delete(key)); };
  b2.deletePrivatePrefixCompletely = async prefix => { calls.push(['purge', prefix]); if (controls.failCleanup) throw Error('B2 unavailable'); for (const key of versions.keys()) if (key.startsWith(prefix)) versions.delete(key); };
  b2.createPrivateDownloadUrl = async ({ objectKey }) => 'https://private.invalid/' + objectKey;
  return { docs, versions, calls, controls, stagedMedia, sub };
}

test('partial acceptance removes rejected Firestore metadata and every staged/orphan object; keeps only selected media and wish', async () => {
  for (const legacy of [false, true]) {
    const state = setup({ legacy });
    const result = await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['video']);
    const saved = await repos.submissions.getById('room', 'sub');
    assert.equal(saved.status, 'approved'); assert.equal(saved.message, state.sub.message);
    assert.deepEqual(saved.mediaIds, ['video']); assert.deepEqual(saved.stagedMedia, []); assert.equal(saved.moderation, null);
    assert.deepEqual([...state.docs.keys()].filter(key => key.includes('/media/')), ['rooms/room/media/video']);
    assert.deepEqual([...state.versions.keys()].sort(), ['rooms/another-room/media/photo.png', 'rooms/room/media/video.mp4']);
    assert.deepEqual(result.promotedMedia.map(item => item.id), ['video']);
    assert.deepEqual(result.removedMediaIds.sort(), ['other', 'photo']);
    assert.ok(state.calls.findIndex(item => item[0] === 'promote') < state.calls.findIndex(item => item[0] === 'delete'));
    assert.equal(JSON.stringify(saved).includes('other.png'), false);
  }
});

test('unknown selection and unauthorized owner cannot mutate storage or claim a decision', async () => {
  const state = setup();
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['foreign']), { code: 'INVALID_MEDIA_SELECTION' });
  await assert.rejects(moderateOwnedSubmissions('intruder', 'room', ['sub'], 'approve', ['photo']), { code: 'ROOM_FORBIDDEN' });
  assert.equal(state.calls.length, 0); assert.equal(state.docs.get('rooms/room/submissions/sub').moderation, undefined);
});

test('cleanup failure leaves a durable decision; a different decision is blocked and the same choice resumes', async () => {
  const state = setup(); state.controls.failCleanup = true;
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['photo']), { code: 'MEDIA_CLEANUP_FAILED' });
  assert.equal(state.docs.get('rooms/room/submissions/sub').status, 'new');
  assert.deepEqual(state.docs.get('rooms/room/submissions/sub').moderation.acceptedMediaIds, ['photo']);
  const count = state.calls.length;
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['video']), { code: 'MODERATION_IN_PROGRESS' });
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'delete'), { code: 'MODERATION_IN_PROGRESS' });
  assert.equal(state.calls.length, count);
  state.controls.failCleanup = false;
  await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['photo']);
  assert.equal(state.docs.get('rooms/room/submissions/sub').status, 'approved');
  assert.ok(state.versions.has('rooms/room/media/photo.png'));
});

test('failed Firestore finalization retries from the accepted copy after staging was purged', async () => {
  const state = setup(); state.controls.failCommit = true;
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['video']), /Firestore interrupted/);
  assert.ok(![...state.versions.keys()].some(key => key.includes('/submissions/')));
  assert.equal(state.docs.get('rooms/room/submissions/sub').status, 'new');
  const result = await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['video']);
  assert.deepEqual(result.promotedMedia.map(item => item.id), ['video']);
  assert.equal(state.docs.get('rooms/room/submissions/sub').status, 'approved');
});

test('failed promotion never deletes any source or rejected file', async () => {
  const state = setup(); state.controls.failPromotion = true;
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['video']), { code: 'MEDIA_PROMOTION_FAILED' });
  assert.equal(state.calls.filter(item => item[0] !== 'promote').length, 0);
  assert.ok(state.versions.has('rooms/room/submissions/sub/video.mp4'));
});

test('conflicting simultaneous reviews have exactly one winner', async () => {
  const state = setup();
  const outcomes = await Promise.allSettled([moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['photo']), moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['video'])]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(item => item.status === 'rejected').reason.code, 'MODERATION_IN_PROGRESS');
  assert.deepEqual(state.docs.get('rooms/room/submissions/sub').mediaIds, ['photo']);
  assert.ok(state.versions.has('rooms/room/media/photo.png'));
  assert.ok(!state.versions.has('rooms/room/media/video.mp4'));
});

test('repeated successful review returns accepted media without more B2 mutations; published media cannot be deleted', async () => {
  const state = setup();
  await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['photo']);
  const count = state.calls.length;
  const retry = await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', ['photo']);
  assert.deepEqual(retry.promotedMedia.map(item => item.id), ['photo']);
  await assert.rejects(moderateOwnedSubmissions('owner', 'room', ['sub'], 'delete'), { code: 'APPROVED_MEDIA_PROTECTED' });
  assert.equal(state.calls.length, count);
});

test('accepting no media keeps the wish, or excludes an empty submission; whole deletion is idempotent', async () => {
  for (const message of ['Selamat ulang tahun!', null]) {
    const state = setup({ message });
    await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', []);
    const saved = await repos.submissions.getById('room', 'sub');
    assert.equal(saved.status, message ? 'approved' : 'excluded'); assert.deepEqual(saved.mediaIds, []); assert.deepEqual(saved.stagedMedia, []);
    assert.equal([...state.versions.keys()].filter(key => key.startsWith('rooms/room/')).length, 0);
    assert.equal([...state.docs.keys()].filter(key => key.includes('/media/')).length, 0);
  }
  const state = setup({ legacy: true });
  await moderateOwnedSubmissions('owner', 'room', ['sub'], 'delete');
  const retry = await moderateOwnedSubmissions('owner', 'room', ['sub'], 'delete');
  assert.deepEqual(retry.deletedSubmissionIds, ['sub']); assert.equal(state.docs.size, 1);
});

test('old full-approve/exclude API and text-only submissions stay compatible', async () => {
  setup(); const all = await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve'); assert.equal(all.promotedMedia.length, 3);
  const excluded = setup({ legacy: true }); await moderateOwnedSubmissions('owner', 'room', ['sub'], 'exclude');
  assert.equal(excluded.docs.get('rooms/room/submissions/sub').status, 'excluded'); assert.equal(excluded.docs.size, 2);
  const text = setup(); text.docs.set('rooms/room/submissions/sub', { ...text.sub, stagedMedia: [] });
  await moderateOwnedSubmissions('owner', 'room', ['sub'], 'approve', []);
  assert.equal(text.docs.get('rooms/room/submissions/sub').status, 'approved');
  assert.equal(ownerSubmissionActionSchema.safeParse({ submissionIds: ['one', 'two'], action: 'approve', acceptedMediaIds: [] }).success, false);
});

