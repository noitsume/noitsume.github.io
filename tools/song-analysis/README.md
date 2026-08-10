# Song Analysis Tool

Patch 6 development-time tooling for curated Kenangin music.

```bash
npm run songs:analyze
python3 tools/song-analysis/analyze.py public/creative/songs --verify-hash-folder
```

The MVP analyzer intentionally supports 16-bit PCM WAV so the repository does not gain a runtime media worker or Python dependency. It writes `beatmap.json` beside each `track.wav` with SHA-256 identity, duration, BPM estimate, beat grid, onsets, normalized energy curve, and coarse intro/build/peak/outro sections.

This tool runs during catalog development only. Receiver runtime reads the precomputed metadata and never invokes Python or audio analysis.
