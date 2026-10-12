/* eslint-disable @typescript-eslint/no-require-imports */
// Compatibility smoothing probe + current tempo estimator. The v2 renderer does not use smoothAccent.
require('../../tests/register.cjs');
const { estimatePulse } = require('../../lib/audio/extract.ts');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = path.resolve(__dirname, '../../lib/receiver/playback.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const functions = {};
new Function('exports', compiled)(functions);
const dt = 1 / 30;
const results = [];
const rows = ['time_sec,raw_pulse,smoothed_pulse'];
for (const beatTime of [.25, .251, .266, .28]) {
  let filtered = 0, maximum = -Infinity, maximumAt = null;
  for (let frame = 1; frame <= 75; frame++) {
    const t = frame * dt;
    const raw = functions.beatPulse([beatTime], t);
    filtered = functions.smoothAccent(filtered, raw, dt);
    assert.ok(Number.isFinite(filtered) && filtered >= 0 && filtered <= 1);
    if (filtered > maximum) { maximum = filtered; maximumAt = t; }
    if (beatTime === .25) rows.push(`${t.toFixed(6)},${raw.toFixed(6)},${filtered.toFixed(6)}`);
  }
  results.push({beatTimeSec:beatTime, peakTimeSec:maximumAt, peakDelayMs:(maximumAt-beatTime)*1000, peakAmplitude:maximum});
}
const decayRate = 7, filterRate = 1 / .24;
const syntheticTempoProbe=[120,150].map(bpm=>{
  const binsPerBeat=(60/bpm)/.05;
  const envelope=Array.from({length:800},(_,i)=>i%binsPerBeat===0?1:0);
  return {inputPulseBpm:bpm,estimatedBpm:estimatePulse(envelope,.05).bpm,binsPerBeat};
});
const result = {
  source:'lib/receiver/playback.ts: beatPulse + smoothAccent',
  tempoSource:'lib/audio/extract.ts: estimatePulse (v2)',
  scope:'Legacy smoothing remains measurable for comparison; current v2 rendering uses sampleAudioTimeline without this delayed low-pass.',
  method:'Execute actual exported functions with a unit isolated beat and 30Hz signal ticks; no renderer, CSS, browser or audio-output latency included.',
  actualFunctionResults:results,
  continuousLimitPeakDelayMs:Math.log(decayRate/filterRate)/(decayRate-filterRate)*1000,
  syntheticTempoProbe,
  limitation:'Not a measurement of end-to-end device latency or subjective synchrony. Repeated beats, gain changes and render timing can alter the result.',
};
const output=path.resolve(__dirname,'../../tmp/aura-reference-deep');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'current-aura-response.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(output,'current-aura-response.csv'),rows.join('\n')+'\n');
console.log(JSON.stringify(result,null,2));
