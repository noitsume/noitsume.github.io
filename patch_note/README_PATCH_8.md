# Kenangin Patch 8

Patch 8 turns the selected ExperienceDNA from Patch 7 into a stable published Receiver snapshot and makes the first real Receiver runtime directly testable.

## End-to-end flow

```text
Settings Studio
-> select final Direction
-> Mulai Bake
-> Preflight / Build Manifest / Publish Token
-> Selesai
-> Preview /r/{receiverId}
```

Bake is synchronous deterministic publication. It does **not** render MP4, create a background queue, run FFmpeg, or call Gemini again.

## Receiver v1

`/r/{receiverId}` now executes the supplied scroll blueprint with:

- vertical scroll snap + center-focus watermill scaling;
- Hero greeting;
- moving memory backdrop;
- video sections and one grouped photo-slide section;
- foreground volume, trim, loop and fit settings;
- continuous background music with section duck/release;
- wishes pop/grow;
- Theme ornament placement;
- basic catalog Aura/Transition treatment;
- reduced-motion fallback.

Private B2 media/music use stable Receiver asset IDs. The public manifest never stores a presigned URL or arbitrary B2 object key.

## Re-Bake

The Receiver token stays the same. Each successful Bake increments `revision`. Opening Studio again does not remove the currently published Receiver; the old revision stays live until the next Bake succeeds.

## Local verification

Run:

```bash
npm run check
```

Then perform a real Room flow through Bake and open the generated Receiver URL.

See `patch_note/PATCH_8_MANIFEST.txt` for the exact architecture and verification checklist.
