# Patch 3 — Authentication + Dynamic Dashboard + Room CRUD

Patch 3 mengganti owner experience dari mock menjadi Firebase Auth + Firestore nyata, tanpa mengubah visual language Dashboard Patch 1.

## Implementasi

- Login dan register dengan Firebase Email/Password.
- Login Google via Firebase Web SDK.
- Firebase ID token ditukar menjadi HTTP-only server session cookie.
- Client Firebase Auth memakai in-memory persistence lalu sign-out setelah session cookie berhasil dibuat.
- Double-submit CSRF token + same-origin validation untuk mutation API.
- `proxy.ts` melakukan optimistic redirect untuk `/dashboard` dan `/rooms/*`; authorization sebenarnya tetap diverifikasi server-side.
- User Firestore dibuat/disinkronkan saat login pertama.
- Navbar memakai nama, email, dan avatar akun nyata.
- Logout menghapus server session.
- Dashboard membaca Room milik UID yang login dari Firestore.
- Statistik, pinned Room, active Room, recent-opened, dan sorting menggunakan data nyata.
- `Dashboard User` diganti menjadi `Dashboard Owner`.
- Event Mendatang memakai curated event catalog dan memilih event sesudah waktu sekarang.
- `/rooms/new` membuat Room nyata dengan `roomId` + `collectorId` server-generated.
- `/rooms/[id]` memberi Room overview dasar dan ownership check.
- `/rooms/[id]/edit` mengubah detail Room.
- Pin/unpin, delete, dan recent-open tracking tersedia melalui owner-only API.
- Room schema ditambah `config`, `lastBakedAt`, dan `schemaVersion` untuk patch berikutnya.
- Firestore Rules diperketat: mutation `users` dan `rooms` hanya melalui Next.js server/Admin SDK.

## Endpoint baru

- `GET /api/auth/csrf`
- `POST /api/auth/session`
- `DELETE /api/auth/session`
- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/:id`
- `PATCH /api/rooms/:id`
- `DELETE /api/rooms/:id`
- `POST /api/rooms/:id/pin`
- `POST /api/rooms/:id/open`

## Tidak termasuk Patch 3

- Public Collector `/c/[collectorId]`.
- Upload B2 submission.
- Submission review.
- Gemini Media Intelligence.
- Settings Studio / Experience Director.
- Bake / Receiver.
- Analytics Receiver nyata.

Fitur tersebut tetap mengikuti Patch 4 dan seterusnya.

## Setelah memasang Patch 3

Jalankan:

```bash
npm run check
npm run firebase:deploy
npm run infra:check
```

Lalu lakukan smoke test manual:

1. Buka `/dashboard` tanpa login -> harus diarahkan ke `/login`.
2. Register dengan email/password -> masuk Dashboard dan `users/{uid}` muncul di Firestore.
3. Logout -> `/dashboard` tidak bisa dibuka lagi tanpa login.
4. Login kembali -> session tetap bekerja melalui server cookie.
5. Login Google -> Dashboard memakai profile Google.
6. Buat Room -> Room muncul di Firestore dengan `ownerUid` UID akun yang login dan `status=collecting`.
7. Room baru muncul di Dashboard.
8. Edit Room -> data Firestore berubah.
9. Pin/unpin -> bagian Pinned berubah.
10. Buka Room -> Riwayat Dashboard memperbarui `lastOpenedAt`.
11. Delete Room -> Room hilang dari Firestore dan Dashboard.
12. Login akun kedua -> akun kedua tidak dapat membaca/mengubah Room akun pertama.

## Patch 3 selesai IF

Patch 3 dianggap selesai hanya jika semuanya berikut lulus:

- `npm run check` hijau: lint + typecheck + build.
- `npm run infra:check` hijau.
- Firestore Rules Patch 3 berhasil di-deploy.
- Google dan Email/Password provider aktif di Firebase Auth.
- Register, login, logout, dan protected route bekerja di localhost.
- User pertama kali login otomatis punya document `users/{uid}`.
- Create/Edit/Delete/Pin Room bekerja terhadap Firestore nyata.
- Setiap Room baru memiliki `ownerUid` yang benar dan `collectorId` unik.
- Dashboard tidak lagi membaca Kevin/mock Room.
- User A tidak dapat membuka atau memodifikasi Room milik User B.
- Dashboard visual, light/dark transition, navbar, sidebar, dan responsive layout tidak regress.
- Flow yang sama berhasil setelah deploy Vercel, bukan hanya localhost.

Jika satu poin di atas belum lulus, status Patch 3 masih `IN PROGRESS`.
