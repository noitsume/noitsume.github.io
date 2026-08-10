# Patch 7 Architecture Notes

## Product progression

```text
Mengumpulkan
  ↓ close collection
Ditutup
  ↓ no pending submission + permanent media exists
Mengatur / Settings Studio
  ↓ validated ExperienceDNA selected
Bake                 ← Patch 8 executes publication
  ↓ receiver snapshot + token
Selesai
```

## Studio progression

```text
MEDIA
Owner selects permanent media
Video -> 1 section each
Photos -> 1 grouped photo-slide section
Owner setting: ordering + volume + trim + loop + fit
  ↓ SAVE

STORY ANCHORS
Opening / Climax / Ending
optional; owner can explicitly skip
  ↓ CONFIRM

MUSIC
Curated template
OR
MP3 direct to private B2 -> Analyze -> beat/music metadata Ready
  ↓ SAVE

DIRECTION
Best-effort Deep Analysis for anchors
Wish Intelligence cache
Gemini Experience Director (up to 3 variants)
  ↓ validated / deterministic reconstruction
ExperienceDNA
  ↓ owner selects one
PATCH 8 BAKE INPUT READY
```

## Audio rule

Background music is one continuous global playback timeline. Section activation only changes gain/tuning.

```text
Hero / photo / silent video
  -> music-full

Audible video with foreground volume > 0
  -> auto-duck
  -> smooth duck attack
  -> background stays below foreground
  -> playback position and beat timeline never reset

Leave audible video
  -> smooth release
  -> music-full again
```

The actual scroll/audio runtime controller belongs to Patch 9. Patch 7 stores the deterministic instruction required by that runtime.
