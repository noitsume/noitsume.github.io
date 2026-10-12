/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractAudioFeatures, estimatePulse, fftPower } = require('../lib/audio/extract.ts');
const { audioFeaturesSchema, sampleAudioTimeline, selectAccentTimes } = require('../lib/audio/features.ts');
const { sampleAuraTransport } = require('../lib/receiver/aura-playback.ts');
const { defaultSceneAtmosphere } = require('../lib/studio/contracts.ts');
const hash = 'a'.repeat(64), sr = 22050;
function bursts(times, hz = 100, duration = 4) {
  const pcm = new Float32Array(duration * sr);
  for (const t of times) for (let i = 0; i < .1 * sr && Math.round(t * sr) + i < pcm.length; i++) pcm[Math.round(t * sr) + i] += .7 * Math.sin(2 * Math.PI * hz * i / sr) * Math.exp(-i / sr * 55);
  return pcm;
}
test('FFT resolves a known sine into its expected frequency bin', () => {
  const n=1024, bin=23, input=Float64Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*bin*i/n)), real=new Float64Array(n), imag=new Float64Array(n);
  fftPower(input,real,imag);
  const power=Array.from({length:n/2},(_,i)=>real[i]**2+imag[i]**2);
  assert.equal(power.indexOf(Math.max(...power)),bin);
  assert.ok(power[bin] > 260000);
});
test('tempo uses actual lag: 120 and 150 BPM pulse trains do not acquire grid drift', () => {
  for(const bpm of [120,150]) { const period=60/bpm, hop=.01; const novelty=Array.from({length:2400},(_,i)=>i%Math.round(period/hop)===0?1:0); const result=estimatePulse(novelty,hop); assert.ok(Math.abs(result.bpm-bpm)<.01); assert.equal(result.period,period); }
});
test('opposite stereo phase preserves real attacks, timing and band character', () => {
  const times=[.5,1,1.5,2,2.5,3], left=bursts(times), right=left.map(v=>-v);
  const result=extractAudioFeatures([left,right],sr,hash);
  assert.equal(audioFeaturesSchema.safeParse(result.features).success,true);
  assert.equal(result.features.events.length,times.length);
  for(const t of times) assert.ok(Math.min(...result.features.events.map(e=>Math.abs(e.time-t)))<.035);
  const mono=extractAudioFeatures([left],sr,hash);
  assert.deepEqual(result.features.events,mono.features.events);
  const high=extractAudioFeatures([bursts(times,4000)],sr,hash);
  assert.ok(result.features.curves.low.reduce((a,b)=>a+b,0) > high.features.curves.low.reduce((a,b)=>a+b,0));
});
test('silence produces no invented beats, attacks or signal energy', () => {
  const result=extractAudioFeatures([new Float32Array(sr)],sr,hash);
  assert.deepEqual(result.beats,[]);assert.deepEqual(result.features.events,[]);
  assert.ok(result.features.curves.energy.every(v=>v===0));
  assert.equal(result.features.beatQuality,0);
});
test('sampling lands the impact at its attack and is deterministic through arbitrary seeks', () => {
  const result=extractAudioFeatures([bursts([.5,1,2])],sr,hash), map={...result,energy:result.energyCurve,duration:result.durationSec};
  const event=result.features.events[1];
  assert.ok(sampleAudioTimeline(map,event.time).impact>.7);
  assert.ok(sampleAudioTimeline(map,event.time+.2).impact<.3);
  const before=sampleAudioTimeline(map,.7);sampleAudioTimeline(map,3);assert.deepEqual(sampleAudioTimeline(map,.7),before);
  assert.ok(sampleAudioTimeline(map,.1).echoes.length===0);
});
test('feature validation rejects reordered attacks, duration mismatch and nonfinite curves', () => {
  const valid=extractAudioFeatures([bursts([.5,1])],sr,hash).features;
  assert.equal(audioFeaturesSchema.safeParse({...valid,events:[...valid.events].reverse()}).success,false);
  assert.equal(audioFeaturesSchema.safeParse({...valid,durationSec:2}).success,false);
  assert.equal(audioFeaturesSchema.safeParse({...valid,curves:{...valid.curves,energy:[NaN]}}).success,false);
});

test('paused, muted, buffering, seeking and reduced-motion transports hold their own last frame', () => {
  const result = extractAudioFeatures([bursts([.5, 1, 2])], sr, hash);
  const timeline = { ...result, energy: result.energyCurve, duration: result.durationSec };
  const media = { currentTime: 1.05, paused: false, muted: false, seeking: false, ended: false, readyState: 4 };
  const input = { timeline, media, enabled: true, motion: true, gain: 1, settings: defaultSceneAtmosphere };
  const previous = sampleAuraTransport(input);
  for (const state of [{ paused: true }, { muted: true }, { seeking: true }, { ended: true }, { readyState: 2 }]) {
    assert.deepEqual(sampleAuraTransport({ ...input, media: { ...media, currentTime: 3, ...state }, previous }), { ...previous, active: false });
  }
  for (const state of [{ motion: false }, { enabled: false }, { gain: 0 }, { timeline: undefined }]) {
    assert.deepEqual(sampleAuraTransport({ ...input, ...state, previous }), { ...previous, active: false });
  }
  const back = sampleAuraTransport({ ...input, media: { ...media, currentTime: 2.6 } });
  assert.equal(back.time, 2.6);
  assert.equal(previous.time, 1.05, 'advancing background cannot change the section frame');
  const sought = sampleAuraTransport({ ...input, previous, media: { ...media, currentTime: .2 } });
  assert.equal(sought.time, .2);
  assert.equal(sought.impact, 0, 'seeking backward must not replay old attacks');
});

test('edge accents use actual strong attacks and preserve spacing across the loop boundary', () => {
  const events = [.05, .2, .65, 1.25, 1.85].map(time => ({ time, strength: 1, low: 1, mid: 0, high: 0 }));
  const accents = selectAccentTimes(events, 2);
  assert.deepEqual(accents, [.05, .65, 1.25]);
  const loop = [...accents, ...accents.map(t => t + 2)];
  assert.ok(loop.every((t, i) => !i || t - loop[i - 1] >= .55));
  assert.deepEqual(selectAccentTimes(events.map(e => ({ ...e, strength: .4 })), 2), []);
  assert.deepEqual(selectAccentTimes(events.slice(0, 1), .3), []);
});
