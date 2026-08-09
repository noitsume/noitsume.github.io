# Kenangin — Patch 0

Patch ini adalah **overlay untuk project Next.js default yang baru dibuat**.

## Cara pasang

1. Tutup dev server jika sedang berjalan.
2. Extract isi ZIP ke **root project Next.js** kamu.
3. Pilih **Replace / Timpa** ketika Windows meminta konfirmasi.
4. Hapus folder `.next` jika sudah pernah menjalankan project sebelumnya.
5. Jalankan:

```bash
npm install
npm run check
npm run dev
```

Buka `http://localhost:3000`.

> `npm install` diperlukan karena Patch 0 menambahkan Zod untuk runtime contract validation dan menyelaraskan baseline dependency.

## Yang sudah dikerjakan

- Next.js App Router baseline.
- Strict TypeScript + `@/*` import alias.
- ESLint flat config untuk Next.js 16.
- Tailwind CSS 4 tetap dipertahankan mengikuti recommended default `create-next-app`.
- `.env.example` lengkap untuk Firebase, B2, Gemini, Worker, session.
- Domain contract berbasis Zod:
  - Room
  - Media / MediaInstance / Aura
  - Theme
  - UserProfile
  - Submission
  - ReceiverAnalyticsEvent
  - BakeJob
  - EventDefinition
  - ReceiverManifest
  - Wish
- `Room` sudah memiliki `recipientName` + `occasionId` supaya Dashboard/Room Detail nanti tidak perlu menebak nama penerima dari title.
- Lifecycle `RoomStatus` dipisahkan dari derived Dashboard status (`waiting`, `working`, `ended`).
- Repository interfaces untuk seluruh domain.
- Mock repository provider sebagai sumber data development Patch 0.
- Development seed: Kevin + 2 room yang sudah melakukan bake pertama.
- Helper sorting dan dashboard status.
- Root page kecil hanya sebagai installation smoke screen; ini **bukan desain Dashboard final**.

## Boundary Patch 0

Belum dipasang pada patch ini:

- Firebase SDK / Firebase Admin
- Firestore
- Backblaze SDK
- Gemini SDK
- Auth UI
- Dashboard final
- theme transition final
- Collector
- Editor
- Receiver
- Worker

Hal-hal itu sengaja belum dipasang agar Patch 0 tetap menjadi foundation yang bersih.

## Catatan package manager

ZIP menyediakan `package.json` tetapi tidak menyediakan lockfile. Setelah menimpa project, `npm install` akan membuat/memperbarui `package-lock.json` berdasarkan baseline Patch 0.
