# Patch 3 Hotfix — Navbar, Vercel runtime, Firestore usage audit

## Fixed

- Profile popover no longer clipped by `contain: paint`; navbar/popover stacking is explicitly above workspace content.
- Profile chevron is `>` while closed and rotates to `v` while open.
- Logout remains available in the profile popover and is labelled `Logout`.
- Auth/session code no longer parses unrelated B2/Gemini environment variables just to render `/`, `/login`, or read the session cookie name.
- `/api/health` uses non-throwing service-by-service validation and reports invalid ENV names without exposing secret values.
- Production backend repository provider no longer imports `MockThemeRepository`; themes now come from developer-curated static config.

## Firestore write/read audit

Automatic writes found in Patch 3:

1. `users/{uid}` during session creation.
   - Before: one Firestore write on every login, even if profile data was unchanged.
   - After: unchanged repeat login = 1 read, **0 writes**. A write only occurs for first login or changed name/email/photo.
2. `rooms/{roomId}.lastOpenedAt` from `RoomOpenTracker`.
   - Before: POST on every Room page mount; React remount/Strict Mode could generate duplicate requests during development.
   - After: browser localStorage throttle + server-side 1-hour gate. The client reserves the throttle window before the async request to prevent duplicate in-flight POSTs. The server remains authoritative and skips the Firestore write if `lastOpenedAt` is still fresh.
3. Explicit owner actions: create/edit/pin/delete.
   - These remain write operations only when the owner actually performs the action.
   - No-op pin requests now return without a write if state is already correct.

Read reduction:

- Navbar owner identity now comes directly from the verified session; protected page render no longer performs a Firestore `users/{uid}` read just to display name/email/avatar.
- Room edit/pin/open repository methods no longer perform redundant pre-write and post-write document reads after ownership was already checked by the service layer.

## Mock/dummy audit

- `backendRepositories` (production/server provider): **no mock repositories** after this hotfix.
- Static curated event/theme config is intentional developer-owned config, not user/mock database data.
- `repository-provider.ts` and mock seed/classes remain only for isolated previews/tests and are not used by protected production pages/APIs.
- Dashboard Receiver analytics currently displays explicit zero/empty placeholders and does not issue fake Firestore writes.
- `npm run seed:dev` remains manual only; confirmation is hardened to require `SEED:<projectId>` so dummy seed data is harder to accidentally write to the wrong Firebase project.

## Firestore write budget principle

Patch 3 must not have background loops, polling, realtime listeners, timers, or receiver-view writes. Writes are event-driven and bounded:

- first/changed login profile: max 1 write per session creation that actually changes profile data;
- Room open tracking: max 1 `lastOpenedAt` write per Room per hour due server guard;
- create/edit/pin/delete: user-triggered only.

Future patches should keep high-frequency viewer/analytics signals aggregated or throttled rather than writing on every scroll/render.
