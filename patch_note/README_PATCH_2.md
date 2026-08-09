# Patch 2 — Backend Foundation & Infrastructure

Patch ini menyiapkan koneksi dan kontrak infrastruktur tanpa mengubah Dashboard dari mock data ke data produksi.

Arsitektur revisi Patch 2:

```text
Next.js / Vercel
├── Firebase Auth + Firestore
├── Backblaze B2 (1 private bucket)
│   ├── rooms/
│   ├── theme-assets/
│   ├── aura-assets/
│   └── songs/
├── Gemini API (server-side helper)
└── Browser delivery foundation
    ├── presigned GET/PUT dari B2
    ├── Cache Storage = file/media
    └── IndexedDB = metadata + expiry + LRU
```

Yang ditambahkan:

- Firebase Web SDK + Firebase Admin foundation.
- Firestore rules + emulator config.
- Firestore repository adapters (belum dipasang ke Dashboard).
- Backblaze B2 S3 client + presigned PUT/GET helper.
- Satu private B2 bucket; tidak ada public bucket dan tidak ada Cloudflare.
- Script konfigurasi B2 CORS.
- Browser cache foundation: Cache Storage + IndexedDB + budget/expiry/LRU policy.
- Gemini server client + timeout foundation.
- Standard API response + request ID.
- `/api/health` untuk melihat kelengkapan env tanpa membocorkan secret.
- Dev database seed.
- `infra:check` untuk network test Firebase/B2/Gemini.
- Node runtime dikunci ke 22.x.

Baca `PATCH_2_SETUP_GUIDE.md` dari awal sampai akhir sebelum memasang service eksternal.
