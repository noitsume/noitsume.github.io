"""Exploratory local A/V reference analysis. No uploads; no production analyzer changes.

Dependencies already present in the inspected environment: ffmpeg, numpy, scipy,
matplotlib, Pillow. All detected onsets/tempo candidates are estimates, not labels.
Brightness code values below are NOT calibrated display luminance or a WCAG test.
"""
from pathlib import Path
import argparse
import csv
import hashlib
import json
import subprocess
import numpy as np
from scipy import signal, ndimage
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
source, out = args.source, args.output
out.mkdir(parents=True, exist_ok=True)

def cmd(*argv):
    return subprocess.run(argv, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

probe = json.loads(cmd('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(source)))
video_meta = next(s for s in probe['streams'] if s['codec_type'] == 'video')
audio_meta = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
fps_num, fps_den = map(int, video_meta['avg_frame_rate'].split('/'))
fps = fps_num / fps_den
pts_meta = json.loads(cmd('ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', str(source)))
vt = np.array([float(f['best_effort_timestamp_time']) for f in pts_meta['frames']])
w, h = 135, 240
rgb = np.frombuffer(cmd('ffmpeg', '-v', 'error', '-i', str(source), '-an', '-vf', f'scale={w}:{h}', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'), dtype=np.uint8).reshape(-1,h,w,3)
assert len(rgb) == len(vt), 'Decoded frames must match source PTS.'
assert np.all(np.diff(vt) > 0), 'Frame PTS must increase.'
brightness = rgb.mean(axis=(1,2,3))/255
black_fraction = (rgb.max(axis=3) <= 12).mean(axis=(1,2))
white_fraction = (rgb.min(axis=3) >= 243).mean(axis=(1,2))
black = black_fraction >= .98
white = white_fraction >= .98
visible = ~black
rise = np.flatnonzero(np.r_[False, black[:-1] & visible[1:] & (brightness[1:] > .04)])
bright_rise = np.flatnonzero(np.diff(brightness, prepend=brightness[0]) >= .18)

def runs(mask):
    padded = np.r_[False, mask, False]
    starts = np.flatnonzero(np.diff(padded.astype(int)) == 1)
    ends = np.flatnonzero(np.diff(padded.astype(int)) == -1)
    return list(zip(starts, ends))

# A run of alternating black / non-black frames is direct evidence of a strobe
# pattern; it does not identify the music's beats or validate flash thresholds.
alternation = black[1:] != black[:-1]
alternate_runs = []
for a,b in runs(alternation):
    if b-a >= 7:
        alternate_runs.append({'startSec':float(vt[a]), 'endSec':float(vt[b]+1/fps), 'frames':int(b-a+1), 'cyclesPerSec':fps/2})
alternate_runs.sort(key=lambda v:v['frames'], reverse=True)

sr, hop = 22050, 128
audio = np.frombuffer(cmd('ffmpeg', '-v', 'error', '-i', str(source), '-vn', '-ar', str(sr), '-ac', '2', '-f', 'f32le', 'pipe:1'), dtype='<f4').reshape(-1,2)
band_edges = [(20,180),(180,2000),(2000,8000)]
band_names = ['low','mid','high']

def scale95(values):
    return values/max(float(np.percentile(values,95)),1e-12)

def features(nfft, waveform=None):
    powers=[]
    for channel in (audio if waveform is None else waveform).T:
        freqs, times, z=signal.stft(channel,sr,nperseg=nfft,noverlap=nfft-hop,boundary='zeros',padded=True)
        powers.append(np.abs(z)**2)
    power=np.mean(powers,axis=0)
    mag=np.sqrt(power)
    logmag=np.log1p(100*mag)
    positive=np.maximum(0,np.diff(logmag,axis=1,prepend=logmag[:,:1]))
    energy=np.array([power[(freqs>=lo)&(freqs<hi)].sum(axis=0) for lo,hi in band_edges])
    raw=np.array([positive[(freqs>=lo)&(freqs<hi)].mean(axis=0) for lo,hi in band_edges])
    raw=np.vstack([raw,positive[(freqs>=20)&(freqs<8000)].mean(axis=0)])
    local_mean=ndimage.uniform_filter1d(raw,size=int(.2*sr/hop)//2*2+1,axis=1,mode='nearest')
    novelty=np.maximum(0,raw-local_mean)
    novelty=np.array([scale95(row) for row in novelty])
    return times, energy, novelty, freqs, power

times, energy, novelty, freqs, power=features(1024)
assert np.all(np.isfinite(novelty)) and np.all(novelty >= 0)
assert np.all(np.isfinite(energy)) and np.all(energy >= 0)
active_start, active_end = 3.0, float(vt[-1]+1/fps)
active_duration=active_end-active_start
video_events=vt[rise]
video_active=video_events[(video_events>=active_start)&(video_events<active_end)]
rng=np.random.default_rng(1729)
shifts=rng.uniform(.35,active_duration-.35,400)

def peaks_at(nov, threshold):
    peaks, _=signal.find_peaks(nov, height=threshold, prominence=threshold*.7, distance=round(.10*sr/hop))
    return peaks

def nearest_dist(a,b):
    if len(a)==0 or len(b)==0: return np.full(len(a),np.inf)
    return np.min(np.abs(a[:,None]-b[None,:]),axis=1)

def alignment(event_times):
    ae=event_times[(event_times>=active_start)&(event_times<active_end)]
    dist=nearest_dist(video_active,ae)
    null=[]
    for shift in shifts:
        shifted=(ae-active_start+shift)%active_duration+active_start
        null.append(np.mean(nearest_dist(video_active,shifted)<=.05))
    return {'videoEvents':len(video_active),'audioCandidates':len(ae),'within50msFraction':float(np.mean(dist<=.05)),
            'medianNearestMs':float(np.median(dist)*1000),'shiftControlMean':float(np.mean(null)),
            'shiftControlP05P95':np.percentile(null,[5,95]).tolist(),
            'fractionOfShiftControlsAtLeastObserved':float(np.mean(np.array(null)>=np.mean(dist<=.05)))}

def block_alignment(event_times):
    """Keep local event density: circularly rotate candidates within 2s blocks.

    Distances use the same circular block metric for observed and control events.
    This is an exploratory negative control, not a calibrated hypothesis test.
    """
    controls=np.random.default_rng(2718)
    tolerances=[.02,1/30,.05]
    observed=[[] for _ in tolerances]
    null=np.zeros((400,len(tolerances)),dtype=float)
    nvideo=0
    for a in np.arange(active_start,active_end,2.0):
        b=min(a+2,active_end);span=b-a
        v=video_events[(video_events>=a)&(video_events<b)]-a
        e=event_times[(event_times>=a)&(event_times<b)]-a
        if len(v)==0:continue
        nvideo+=len(v)
        def distance(ve,ae):
            if len(ae)==0:return np.full(len(ve),np.inf)
            d=np.abs(ve[:,None]-ae[None,:]);return np.min(np.minimum(d,span-d),axis=1)
        d=distance(v,e)
        for j,tol in enumerate(tolerances):observed[j].extend((d<=tol).tolist())
        for k,shift in enumerate(controls.uniform(.10*span,.90*span,400)):
            ds=distance(v,(e+shift)%span)
            for j,tol in enumerate(tolerances):null[k,j]+=np.count_nonzero(ds<=tol)
    null/=nvideo
    return [{'toleranceMs':round(tol*1000,3),'observedFraction':float(np.mean(observed[j])),
             'controlMean':float(np.mean(null[:,j])),'controlP05P95':np.percentile(null[:,j],[5,95]).tolist()}
            for j,tol in enumerate(tolerances)]

sensitivity=[]
for nfft in [1024,2048]:
    ft,fe,fn,_,_=features(nfft) if nfft!=1024 else (times,energy,novelty,freqs,power)
    for threshold in [.35,.65,1.0]:
        for band in [0,3]:
            peaks=peaks_at(fn[band],threshold)
            sensitivity.append({'nfft':nfft,'thresholdRelativeToP95':threshold,'band':(['low','mid','high','broadband'][band]),**alignment(ft[peaks]),'localDensityControl':block_alignment(ft[peaks])})

primary_peaks=peaks_at(novelty[3],.65)
low_peaks=peaks_at(novelty[0],.65)
# A known synthetic click fixture checks gross timebase mistakes; it does not
# validate detection accuracy on music, piano attacks, vocals or distorted bass.
known_times=np.array([.4,1.1,1.95,2.7])
fixture=np.zeros((int(3.2*sr),2),dtype=np.float32)
fixture_rng=np.random.default_rng(17)
for t in known_times:
    n=int(.025*sr); click=fixture_rng.standard_normal(n)*np.exp(-np.arange(n)/(sr*.006))*.3
    start=int(round(t*sr));fixture[start:start+n,0]=click;fixture[start:start+n,1]=-click
ct,_,cn,_,_=features(1024,fixture)
cp=peaks_at(cn[3],.65)
calibration={'fixture':'Four isolated 25ms decaying noise bursts, stereo opposite polarity. No musical ground truth.',
             'knownTimesSec':known_times.tolist(),'candidateTimesSec':ct[cp].round(6).tolist(),
             'nearestErrorsMs':(nearest_dist(known_times,ct[cp])*1000).round(3).tolist(),
             'monoWaveformWouldCancel':bool(np.all(fixture.mean(axis=1)==0))}
assert len(cp)==len(known_times) and np.max(nearest_dist(known_times,ct[cp]))<.03
_,silent_energy,silent_novelty,_,_=features(1024,np.zeros((sr,2),dtype=np.float32))
assert np.all(silent_energy==0) and np.all(silent_novelty==0)
events=[]
for i in primary_peaks:
    if times[i] > len(audio)/sr: continue
    events.append({'timeSec':round(float(times[i]),6),'noveltyP95Units':round(float(novelty[3,i]),4),'lowNovelty':round(float(novelty[0,i]),4),'midNovelty':round(float(novelty[1,i]),4),'highNovelty':round(float(novelty[2,i]),4)})
with (out/'onset-candidates.csv').open('w',newline='',encoding='utf8') as f:
    writer=csv.DictWriter(f,fieldnames=list(events[0]));writer.writeheader();writer.writerows(events)

def tempo_candidates(start,end,row):
    x=row[(times>=start)&(times<end)]
    x=x-np.mean(x)
    ac=signal.correlate(x,x,mode='full',method='fft')[len(x)-1:]
    ac=ac/max(ac[0],1e-12)
    lags=np.arange(len(ac))*hop/sr
    lo=int(np.floor((60/220)*sr/hop));hi=int(np.ceil((60/55)*sr/hop))
    pk,_=signal.find_peaks(ac[lo:hi],distance=5)
    idx=pk+lo
    idx=idx[np.argsort(ac[idx])[::-1]][:4]
    return [{'bpm':round(float(60/lags[i]),2),'autocorrelation':round(float(ac[i]),3)} for i in idx]

sections=[]
for start,end in [(0,3),(3,6),(6,9),(9,15),(15,21),(21,active_end)]:
    vm=(vt>=start)&(vt<end);am=(times>=start)&(times<end)
    ep=energy[:,am].sum(axis=1);ep=ep/max(ep.sum(),1e-12)
    sections.append({'startSec':start,'endSec':end,'blackFrameFraction':round(float(black[vm].mean()),3),'nearWhiteFrameFraction':round(float(white[vm].mean()),3),
       'blackToVisibleCount':int(np.count_nonzero((video_events>=start)&(video_events<end))),
       'broadbandOnsetCandidates':int(np.count_nonzero((times[primary_peaks]>=start)&(times[primary_peaks]<end))),
       'spectralEnergyFractionLowMidHigh':ep.round(3).tolist(),
       'tempoCandidates':tempo_candidates(start,end,novelty[3]) if end-start>=5 else []})

# Alignment examples selected deterministically: one close and one distant event.
nearest=nearest_dist(video_active,times[primary_peaks])
examples=[]
for label, idx in [('near',int(np.argmin(nearest))),('distant',int(np.argmax(nearest)))]:
    t=video_active[idx]; ai=primary_peaks[int(np.argmin(np.abs(times[primary_peaks]-t)))]
    examples.append({'selection':label,'visualTimeSec':round(float(t),6),'nearestAudioCandidateSec':round(float(times[ai]),6),'distanceMs':round(float(abs(t-times[ai])*1000),2)})

plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(3,1,figsize=(13,7.8),sharex=True,layout='constrained')
for band,color in [(0,'#b66b18'),(1,'#356cab'),(2,'#428372')]:
    ax[0].plot(times,np.minimum(scale95(energy[band]),1.5),label=f'{band_names[band]} {band_edges[band][0]}–{band_edges[band][1]} Hz',lw=.8,color=color,alpha=.85)
ax[0].set_ylabel('Band power / own P95');ax[0].legend(ncol=3,loc='upper right')
ax[1].plot(times,novelty[3],color='#356cab',lw=.8,label='Broadband onset novelty')
ax[1].scatter(times[primary_peaks],novelty[3,primary_peaks],s=8,color='#b66b18',label='Candidates; not annotated beats');ax[1].set_ylabel('Novelty / P95');ax[1].legend(loc='upper right')
ax[2].plot(vt,brightness,color='#343d44',lw=.65);ax[2].set_ylabel('Mean RGB code / 255');ax[2].set_xlabel('Source media time (seconds)')
for a in ax:a.set_xlim(0,active_end);a.grid(alpha=.16)
fig.suptitle('Reference audit: audio features and frame brightness (exploratory, not a flash compliance test)')
fig.savefig(out/'timeline.png',dpi=150);plt.close(fig)

fig,axs=plt.subplots(2,2,figsize=(12,5.8),sharex='col',layout='constrained')
for col,(a,b) in enumerate([(4.1,5.1),(15.0,16.0)]):
    axs[0,col].plot(times,novelty[3],color='#356cab',lw=1)
    ids=primary_peaks[(times[primary_peaks]>=a)&(times[primary_peaks]<=b)]
    for i in ids:axs[0,col].axvline(times[i],color='#b66b18',ls='--',lw=1);axs[1,col].axvline(times[i],color='#b66b18',ls='--',lw=1,alpha=.6)
    axs[0,col].set_ylim(0,max(1.5,float(np.max(novelty[3,(times>=a)&(times<=b)])))*1.1)
    axs[1,col].step(vt,brightness,where='post',color='#343d44',lw=1.2)
    axs[0,col].set_title(f'{a:.1f}–{b:.1f} s');axs[1,col].set_xlabel('Source media time (seconds)')
    for row in [0,1]:axs[row,col].set_xlim(a,b);axs[row,col].grid(alpha=.2)
axs[0,0].set_ylabel('Onset novelty / P95');axs[1,0].set_ylabel('Mean RGB code / 255')
fig.suptitle('Dashed lines = estimated audio attacks; lower trace = frame brightness')
fig.savefig(out/'alignment-zoom.png',dpi=150);plt.close(fig)

# Static contact sheet: seek near each target, preferring nonblank/nonwhite content.
targets=[.2,1.2,2.2,3.1,4.1,5.3,6.4,7.5,8.6,9.7,11.0,12.3,13.6,15.0,16.3,17.6,19.0,21.0,23.0,25.3]
sheet=Image.new('RGB',(5*180,4*345),'#20262b');draw=ImageDraw.Draw(sheet);picked=[]
for k,t in enumerate(targets):
    candidates=np.flatnonzero((np.abs(vt-t)<.16)&(~black)&(~white))
    i=int(candidates[np.argmin(np.abs(vt[candidates]-t))]) if len(candidates) else int(np.argmin(np.abs(vt-t)))
    im=Image.fromarray(rgb[i]).resize((180,320))
    x=(k%5)*180;y=(k//5)*345
    sheet.paste(im,(x,y+25));draw.text((x+8,y+7),f'{vt[i]:.3f} s',fill='white');picked.append(float(vt[i]))
sheet.save(out/'storyboard.png')

detail_times=np.arange(round(4.1*fps),round(4.1*fps)+10)
sheet=Image.new('RGB',(10*108,217),'#20262b');draw=ImageDraw.Draw(sheet)
for k,i in enumerate(detail_times):
    sheet.paste(Image.fromarray(rgb[i]).resize((108,192)),(k*108,25));draw.text((k*108+4,7),f'{vt[i]:.3f}s',fill='white')
sheet.save(out/'consecutive-frames.png')

result={
 'sourceName':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'metadata':{'videoDurationSec':float(video_meta['duration']),'audioDurationSec':float(audio_meta['duration']),'decodedAudioDurationSec':len(audio)/sr,'videoFrames':len(vt),'fps':fps,'videoStart':video_meta['start_time'],'audioStart':audio_meta['start_time'],'frameSpacingMinMaxSec':[float(np.min(np.diff(vt))),float(np.max(np.diff(vt)))],'colorSpace':video_meta.get('color_space'),'colorTransfer':video_meta.get('color_transfer')},
 'method':{'audioSampleRate':sr,'hop':hop,'windowSamples':[1024,2048],'stereoPolicy':'average channel power, no waveform downmix cancellation','novelty':'positive difference of log1p(100*magnitude), subtract 0.2s local mean, divide by P95','candidateMinSpacingSec':.1,'primaryThresholdP95Units':.65,'blackDefinition':'at least 98% pixels have all RGB code values <= 12','nearWhiteDefinition':'at least 98% pixels have all RGB code values >= 243','alignmentToleranceSec':.05,'shiftControl':'400 seeded circular shifts of audio events inside active window; not a calibrated significance test','localDensityControl':'400 independent rotations within 2-second blocks with circular observed/control distances at 20, 33.33, 50ms tolerance','activeWindowSec':[active_start,active_end],'limitations':['No human onset/beat annotation','No subjective listening assessment','Brightness proxy is RGB code mean, not calibrated relative display luminance','30 fps limits video temporal resolution','Short clip and parameter sensitivity preclude universal timing or genre claims']},
 'frameCounts':{'black':int(black.sum()),'nearWhite':int(white.sum()),'blackToVisible':len(rise),'largePositiveBrightnessChange':len(bright_rise)},
 'longestStrictAlternatingRuns':alternate_runs[:15],
 'sections':sections,'tempoCandidatesGlobal':tempo_candidates(3,active_end,novelty[3]),'syntheticCalibration':calibration,
 'alignmentSensitivity':sensitivity,'alignmentExamples':examples,'storyboardActualTimes':picked,
 'primaryAudioCandidateCount':len(events)
}
(out/'measurements-v2.json').write_text(json.dumps(result,indent=2),encoding='utf8')
np.savez_compressed(out/'features-v2.npz',audio_times=times,novelty=novelty,energy=energy,video_times=vt,brightness=brightness,black=black,white=white)
print(json.dumps(result,indent=2))
