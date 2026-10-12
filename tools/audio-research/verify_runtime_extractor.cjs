/* eslint-disable @typescript-eslint/no-require-imports */
// Decode with ffmpeg to interleaved stereo float32, then exercise the production extractor.
require('../../tests/register.cjs');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { extractAudioFeatures } = require('../../lib/audio/extract.ts');
const { audioFeaturesSchema, sampleAudioTimeline } = require('../../lib/audio/features.ts');
const [pcmPath, audioPath, output] = process.argv.slice(2);
if (!pcmPath || !audioPath || !output) throw Error('Expected stereo-f32 path, source audio path and report path. Sample rate: 22050 Hz.');
const bytes = fs.readFileSync(pcmPath);
const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
const channels = [0, 1].map(channel => Float32Array.from({ length: samples.length / 2 }, (_, i) => samples[2 * i + channel]));
const hash = crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');
const start = performance.now();
const result = extractAudioFeatures(channels, 22050, hash);
audioFeaturesSchema.parse(result.features);
const map = { ...result, duration: result.durationSec, energy: result.energyCurve };
const frameDelays = result.features.events.map(event => {
  const frameTime = Math.ceil(event.time * 60) / 60;
  if (sampleAudioTimeline(map, event.time).eventTime !== event.time) throw Error('Sampler missed event timestamp');
  return 1000 * (frameTime - event.time);
}).sort((a, b) => a - b);
const report = {
  audioFile: audioPath.replaceAll('\\', '/'), sha256: hash, extractor: result.features.extractor,
  durationSec: result.durationSec, extractionMs: +(performance.now() - start).toFixed(1),
  estimatedBpm: result.bpm, pulseConfidence: result.features.beatQuality,
  attacks: result.features.events.length, spectrumBands: result.features.spectrum.bands,
  curveFrames: result.features.curves.energy.length, jsonBytes: Buffer.byteLength(JSON.stringify(result)),
  modeled60HzDelayMs: { p50: frameDelays[Math.floor(frameDelays.length * .5)], p95: frameDelays[Math.floor(frameDelays.length * .95)], max: frameDelays.at(-1) },
  caveat: 'Measured extraction and modeled frame quantization, not beat accuracy or end-to-end audible latency. Reference has no annotated musical ground truth.',
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
