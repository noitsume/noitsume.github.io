/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { S3Client } = require('@aws-sdk/client-s3');
const env = require('../lib/env/server.ts');
const { deletePrivateObjects, deletePrivatePrefixCompletely } = require('../lib/storage/b2.ts');
env.getB2Env = () => ({ B2_ENDPOINT: 'https://storage.invalid', B2_REGION: 'us-test-1', B2_KEY_ID: 'test', B2_APPLICATION_KEY: 'test', B2_BUCKET: 'test' });

test('B2 deletion removes every exact-key version and marker without matching adjacent filenames', async () => {
  const original = S3Client.prototype.send;
  let versions = [{ Key: 'room/a.png', VersionId: 'v1' }, { Key: 'room/a.png', VersionId: 'v2' }, { Key: 'room/a.png.extra', VersionId: 'keep' }];
  let markers = [{ Key: 'room/a.png', VersionId: 'deleted-marker' }];
  const deleted = [];
  S3Client.prototype.send = async function(command) {
    if (command.constructor.name === 'ListObjectVersionsCommand') return { Versions: versions, DeleteMarkers: markers, IsTruncated: false };
    assert.equal(command.constructor.name, 'DeleteObjectsCommand');
    for (const item of command.input.Delete.Objects) { assert.ok(item.VersionId); deleted.push(item); versions = versions.filter(v => v.Key !== item.Key || v.VersionId !== item.VersionId); markers = markers.filter(v => v.Key !== item.Key || v.VersionId !== item.VersionId); }
    return {};
  };
  try { await deletePrivateObjects(['room/a.png']); assert.equal(deleted.length, 3); assert.deepEqual(versions, [{ Key: 'room/a.png.extra', VersionId: 'keep' }]); assert.deepEqual(markers, []); }
  finally { S3Client.prototype.send = original; }
});

test('B2 reports a failed permanent delete instead of accepting a partial cleanup', async () => {
  const original = S3Client.prototype.send;
  S3Client.prototype.send = async function(command) {
    return command.constructor.name === 'ListObjectVersionsCommand' ? { Versions: [{ Key: 'room/staging/file', VersionId: 'locked' }], IsTruncated: false } : { Errors: [{ Key: 'room/staging/file', VersionId: 'locked', Code: 'AccessDenied' }] };
  };
  try { await assert.rejects(deletePrivatePrefixCompletely('room/staging/'), /Gagal menghapus versi object B2/); }
  finally { S3Client.prototype.send = original; }
});
