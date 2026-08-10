# Kenangin Patch 7

Patch 7 turns the permanent media inventory from Patch 5 and the creative catalogs from Patch 6 into a gated Settings Studio and validated ExperienceDNA.

## Run locally

```bash
npm run dev
```

Open a Room, close collection, finish submission review, then click **Mulai Mengatur**. The Studio route is:

```text
/rooms/{roomId}/studio
```

Studio gates:

```text
Media -> Story Anchors -> Music -> Direction
```

For custom music, upload an MP3 and click **Analyze** before continuing.

## Important boundary

Patch 7 prepares and selects the final ExperienceDNA. It does not publish a Receiver. Patch 8 owns Bake preflight, `baking` status, Receiver snapshot, stable receiverId/token/link, and transition to `ready`.

Before deploy:

```bash
npm run check
```

See `patch_note/PATCH_7_MANIFEST.txt` and `patch_note/PATCH_7_ARCHITECTURE.md` for implementation details.
