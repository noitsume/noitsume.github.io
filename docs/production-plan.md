# Kenangin production completion

## Phase 1 — Investigation and design

User scope: complete the existing live product, improve every primary journey,
preserve the warm identity and existing data. The supplied 12-patch roadmap is
reference material. No deployment or git push is part of this change.

Baseline: Next 16.2.12 / React 19, plain CSS, Firebase Auth + Firestore,
private B2, Gemini. Existing working-tree changes are preserved. Login visually
inspected at 1265×712. Owner routes require an authenticated test session.

The cosmetic baseline would restyle existing panels while retaining competing
actions. Chosen approach: derive guidance from persisted Room state, reveal only
the next unmet prerequisite, and put backward/forward actions in predictable
positions. Detail settings remain available through progressive disclosure.
This is a case-specific synthesis, not a claim of a new UX algorithm.

Invariants: selected media remain included; published links remain stable;
editing a draft cannot alter the published revision; a failed publish cannot
claim success; metadata and files remain owner-scoped; contributor input survives
recoverable failures; motion is never required to navigate or read a wish.

Art direction: a personal memory desk, warm paper, coral as action/selection,
quiet borders, editorial titles, generous reading space, and compact metadata.
Keep the established scene and assets; avoid layering more decorative cards.

## Phase 2 — Implementation

- Shared navigation, explicit journey steps, guided Room workspace, readable
  copy, accessible dialogs, loading/error recovery, dashboard and useful guide.
- Studio backward/forward controls, retained drafts, clear optional settings,
  honest publication state, share/reopen flow.
- Receiver start gesture, navigation, complete readable wishes, controlled
  adjacent-media loading, audio ducking based on actual playback, beat/energy
  treatment, reduced motion, per-asset failure recovery, revision-scoped cache.
- Idempotent daily analytics, bounded public/generation requests, publication
  concurrency validation, complete Room teardown, safe maintenance tooling.

## Phase 3 — Verification

Run npm lint, typecheck, build and meaningful regression checks. Inspect actual
desktop and narrow layouts, focus and keyboard navigation, reduced-motion and
error states. Distinguish fixture checks from live integration checks. Never
claim real-device Safari or field Web Vitals without running those checks.

## Research and mechanism

- [WAI multi-page forms](https://www.w3.org/WAI/tutorials/forms/multi-page/):
  explicit progress and return navigation. Adapt to Room prerequisites instead
  of a rigid wizard that prevents reviewing previously saved work.
- [WAI modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
  contained focus, inert background, Escape and focus restoration. Native dialog
  supplies the browser mechanics; custom styling preserves Kenangin's identity.
- [MDN Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices):
  unlock playback through an explicit user gesture. Audio timeline stays intact
  while the gain changes; paused/error/muted foreground must release ducking.
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions):
  transaction retries require pure callbacks. Publication checks the current
  Studio revision inside the transaction; external B2 checks occur beforehand.

Risks to test first: repeated publish and edits during publication, wish-only
retries, full-length 3000-character wishes, denied cache storage, muted/paused
foreground, expired Room, and narrow-screen fixed navigation.
