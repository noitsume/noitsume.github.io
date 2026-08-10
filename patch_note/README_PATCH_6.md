# Patch 6 — Creative Catalog Foundation

Patch 6 turns Kenangin's creative vocabulary into deterministic, versioned code before Gemini Experience Director is introduced.

## Catalogs

- `config/themes.ts` — 5 curated themes.
- `config/auras.ts` — official Aura IDs and renderer contracts.
- `config/transitions.ts` — official transition IDs and compatibility rules.
- `config/songs.ts` — curated music metadata and reusable Song Intelligence.
- `lib/creative/` — ID schemas, contracts, resolvers, and compatibility validation.

Unknown Theme/Song/Aura/Transition IDs are rejected by the catalog helpers. Theme ↔ Aura and Theme ↔ Transition compatibility is validated in both directions.

## Theme assets

Theme assets live under `public/creative/themes/` and are referenced by stable logical public paths rather than expiring signed URLs. The contract also supports stable B2 object keys for future private curated assets.

Use `/dev/theme-anchor` during development to position theme anchors. The route is disabled in production. It stores drafts in browser localStorage and can copy the reviewed anchor JSON back into `config/themes.ts`.

## Music

Three lightweight original WAV tracks live under `public/creative/songs/{sha256}/`. Each track has a precomputed `beatmap.json`.

Run:

```bash
npm run songs:analyze
```

The analyzer is development-time only and does not create a worker, queue, or Receiver runtime dependency.

## Next

Patch 7 may consume only creative IDs present in these catalogs when generating ExperienceDNA.
