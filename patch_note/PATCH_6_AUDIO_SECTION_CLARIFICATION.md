# Patch 6 Hotfix — Theme Anchor lint + Background Music/Section Foundation

## Lint fix

`components/dev/theme-anchor-tool.tsx` no longer calls `setState` synchronously from an Effect.

- persisted local drafts are modeled as an external `localStorage` store via `useSyncExternalStore`;
- unsaved edits stay in normal React state;
- selected anchor uses a derived fallback instead of an Effect that synchronizes state.

This keeps local draft persistence without the `react-hooks/set-state-in-effect` violation.

## Background music direction

Background music is an owner choice per Room. Curated Patch 6 songs remain fallback/default/demo choices, but Patch 7 may also store an owner-uploaded track in private B2.

Creative contracts now distinguish:

```text
backgroundMusic
├── source: catalog
│   └── songId
└── source: room-upload
    └── musicId
```

`RoomMusic` foundation stores a stable Room-scoped ID, private B2 audio reference, reusable analysis state, optional beatmap, and beat/song intelligence fields.

## Audio mix invariant

Background music is a continuous global layer. Changing section must not restart the track, move playback position, change playback rate, or destroy the beat timeline.

Baseline mix policy:

- normal gain target: `0.72`;
- ducked gain fallback target: `0.22`;
- attack: `320 ms`;
- release: `720 ms`;
- target background headroom while foreground media audio is audible: `-8 dB` relative or lower;
- exact runtime mixing remains Patch 9 work.

The numeric gain is a deterministic fallback, not a claim that raw source files have equal perceived loudness. Patch 9's audio controller should prioritize foreground media and may refine gain using runtime/analysis signals.

## Section execution direction

Patch 7 ExperienceDNA should be section-oriented. Hero and each content section get their own tuning bundle: media treatment, Aura, transition, pacing, intensity, wishes/copy, beat alignment, and audio-mix instruction.

Patch 9 `ScrollFocusController` becomes the authority that activates the tuning for the focused section and coordinates `BackgroundMusicController` / `AudioMixController`.

- audible video/audio => background music smoothly ducks;
- photo/silent video/muted media => background music smoothly returns to normal;
- ducking changes gain only, so the beat continues uninterrupted.
