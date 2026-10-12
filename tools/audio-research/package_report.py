"""Package the measured research evidence; no app or source-media modifications."""
from pathlib import Path
import shutil
import json
import csv
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path(__file__).resolve().parents[2]
src=root/'tmp/aura-reference-deep'
dst=root/'docs/research/aura-reference-2026-10-12'
dst.mkdir(parents=True,exist_ok=True)
for name in ['measurements-v2.json','onset-candidates.csv','current-aura-response.json','current-aura-response.csv','timeline.png','alignment-zoom.png','storyboard.png','consecutive-frames.png']:
    shutil.copy2(src/name,dst/name)
rows=np.genfromtxt(src/'current-aura-response.csv',delimiter=',',names=True)
t=(rows['time_sec']-.25)*1000
mask=(t>=-60)&(t<=850)
fig,ax=plt.subplots(figsize=(9,4.4),layout='constrained')
ax.plot(t[mask],rows['raw_pulse'][mask],color='#717a81',lw=2,label='beatPulse output')
ax.plot(t[mask],rows['smoothed_pulse'][mask],color='#2368a0',lw=2.5,label='after smoothAccent (current Aura)')
ax.axvline(0,color='#202a33',ls='--',lw=1)
peak=int(np.argmax(rows['smoothed_pulse']))
ax.scatter([t[peak]],[rows['smoothed_pulse'][peak]],color='#2368a0',zorder=4)
ax.annotate(f'Peak at +{t[peak]:.0f} ms',xy=(t[peak],rows['smoothed_pulse'][peak]),xytext=(300,.56),arrowprops={'arrowstyle':'->','color':'#2368a0'},color='#202a33')
ax.set(xlabel='Time relative to one synthetic beat (ms)',ylabel='Signal amplitude (unit input)',xlim=(-60,850),ylim=(0,1.03),title='Actual receiver functions: 240 ms smoothing delays and attenuates a beat pulse')
ax.legend(loc='upper right');ax.grid(alpha=.16);ax.spines[['right','top']].set_visible(False)
fig.savefig(dst/'current-response-lag.png',dpi=160);plt.close(fig)
print(json.dumps({'evidenceDirectory':str(dst),'files':[p.name for p in dst.iterdir()]},indent=2))
