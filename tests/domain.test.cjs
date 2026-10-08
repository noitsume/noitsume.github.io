/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { activeForegroundVolume, musicGain, beatPulse, energyAt } = require('../lib/receiver/playback.ts');
const { workspaceGuidance, roomDestination } = require('../lib/domain/journey.ts');
const { receiverWishSchema } = require('../lib/data/contracts/receiver.ts');
const { collectorSubmitRequestSchema } = require('../lib/collector/schemas.ts');
const { shouldPersistResource } = require('../lib/browser-cache/policy.ts');

test('low-volume foreground remains louder than ducked music', () => {
  assert.ok(musicGain(.72,.22,-8,.05) < .05);
  assert.equal(musicGain(.72,.22,-8,0), .72);
  assert.equal(musicGain(.72,.22,-8,1,true), 0);
});
test('the final wishes page safely releases foreground audio', () => {
  assert.equal(activeForegroundVolume(null, undefined),0);
  assert.equal(activeForegroundVolume({id:'video',volume:1}, undefined),0);
  assert.equal(activeForegroundVolume({id:'video',volume:.3},'photo'),0);
  assert.equal(activeForegroundVolume({id:'video',volume:.3},'video'),.3);
});
test('beat search has defined behavior before first beat, at beats, and after track', () => {
  assert.equal(beatPulse([1,2,3], .2), 0);
  assert.equal(beatPulse([1,2,3], 2), 1);
  assert.ok(beatPulse([1,2,3], 3.5) < .04);
  assert.equal(beatPulse([], 100), 0);
});
test('energy interpolation clamps at timeline boundaries', () => {
  assert.equal(energyAt([0,1],5,10), .5);
  assert.equal(energyAt([0,1],20,10), 1);
  assert.equal(energyAt([0,1],-1,10), 0);
});
test('guidance follows unfinished work and never hides published result', () => {
  assert.equal(workspaceGuidance('collecting',1,0).action,'review');
  assert.equal(workspaceGuidance('closed',0,0).action,'upload');
  assert.equal(workspaceGuidance('collecting',0,1).action,'close');
  assert.equal(workspaceGuidance('closed',0,1).action,'studio');
  assert.equal(roomDestination({id:'one',status:'ready'}).href,'/rooms/one/finish');
});
test('maximum collector wish survives the receiver contract', () => {
  const text = 'a'.repeat(3000);
  assert.ok(collectorSubmitRequestSchema.safeParse({contributorName:'QA',message:text,media:[],submissionId:'submission_'+'a'.repeat(32)}).success);
  assert.equal(receiverWishSchema.parse({id:'wish',text,contributorName:'QA'}).text.length,3000);
  assert.equal(receiverWishSchema.safeParse({id:'wish',text:text+'x',contributorName:null}).success,false);
});
test('large or unknown-size videos are never persisted', () => {
  assert.equal(shouldPersistResource({kind:'video'}),false);
  assert.equal(shouldPersistResource({kind:'video',sizeBytes:26*1024**2}),false);
  assert.equal(shouldPersistResource({kind:'video',sizeBytes:1024}),true);
});
