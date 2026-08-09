# Kenangin — Patch 2 Setup Guide

Panduan ini dibuat untuk orang yang belum terbiasa mengatur backend/cloud service. Ikuti urutannya. Jangan lompat-lompat kecuali bagian tersebut sudah pernah kamu selesaikan.

## Hasil akhir Patch 2

Setelah semua langkah selesai:

- project Kenangin bisa deploy di Vercel;
- Firebase Auth siap untuk Patch 3;
- Firestore sudah dibuat dan rules dasar sudah aktif;
- Backblaze B2 punya satu bucket PRIVATE;
- browser nanti bisa upload/download langsung ke B2 memakai short-lived presigned URL;
- foundation Cache Storage + IndexedDB sudah tersedia di codebase;
- Gemini server client sudah terhubung;
- Dashboard masih menggunakan mock data dengan sengaja.

Arsitektur storage yang dipakai:

```text
Backblaze B2 — 1 PRIVATE bucket
│
├── rooms/{roomId}/raw/{mediaId}.{ext}
├── theme-assets/{themeId}/...
├── aura-assets/{auraId}/...
└── songs/{songHash}/...
```

Tidak ada Cloudflare dan tidak ada public bucket.

Ketika Receiver nanti mengambil media:

```text
Next.js API
   ↓ membuat presigned GET singkat
Browser
   ↓
cek Cache Storage menggunakan stable key
   ├── sudah ada → pakai lokal
   └── belum ada → fetch B2 → cache → pakai
                    ↓
                 IndexedDB
                 simpan metadata, size, expiry,
                 lastAccessedAt, roomId
```

Cache Storage menyimpan file. IndexedDB hanya menjadi index/lifecycle manager.

---

# A. Pasang file Patch 2 ke project

## A1. Backup dulu

Sebelum copy patch, duplikasi folder project Kenangin kamu agar gampang rollback.

## A2. Extract ZIP patch

Copy isi ZIP ke root project Kenangin.

Kalau Windows menanyakan file lama mau diganti atau tidak, pilih **Replace** untuk file yang memang ada di ZIP.

## A3. Install dependency

Buka terminal di folder project:

```powershell
npm install
```

Setelah selesai:

```powershell
npm run check
```

Kalau `npm install` memperbarui `package-lock.json`, simpan perubahan itu dan commit nanti.

---

# B. Pastikan Node.js 22

Firebase Admin SDK 14 menggunakan Node.js 22 atau lebih baru.

Cek:

```powershell
node -v
```

Target:

```text
v22.x.x
```

Kalau belum 22, install Node.js 22 LTS lalu buka terminal baru.

Project juga sudah mempunyai:

```text
.nvmrc
```

berisi:

```text
22
```

---

# C. Buat file environment lokal

Di PowerShell dari root project:

```powershell
Copy-Item .env.example .env.local
```

Sekarang ada:

```text
.env.example   ← template, boleh masuk Git
.env.local     ← credential asli, JANGAN masuk Git
```

`.env.local` akan kita isi sedikit demi sedikit.

---

# D. Firebase

Firebase akan dipakai untuk:

- Authentication;
- Firestore;
- Firebase Admin pada server Next.js.

## D1. Buat Firebase project

1. Buka https://console.firebase.google.com/
2. Klik **Create a project** / **Add project**.
3. Project name: `Kenangin`.
4. Google Analytics boleh dimatikan untuk MVP.
5. Selesaikan wizard.

Catat **Project ID**. Contoh:

```text
kenangin-12abc
```

Project ID berbeda dari nama tampilan project.

## D2. Tambahkan Firebase Web App

Di Project Overview:

1. Klik icon Web `</>`.
2. App nickname: `kenangin-web`.
3. Jangan aktifkan Firebase Hosting karena hosting kita Vercel.
4. Klik Register App.

Firebase menampilkan config seperti:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "...",
};
```

Masukkan ke `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=nilai_apiKey
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nilai_authDomain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nilai_projectId
NEXT_PUBLIC_FIREBASE_APP_ID=nilai_appId
```

Empat nilai `NEXT_PUBLIC_FIREBASE_*` memang untuk Firebase Web SDK dan boleh tersedia di browser. Security tetap datang dari Authentication + Firestore Rules, bukan dari menyembunyikan config web tersebut.

## D3. Aktifkan Email/Password login

Firebase Console:

```text
Authentication
→ Get started
→ Sign-in method
→ Email/Password
```

Aktifkan **Email/Password**, lalu Save.

## D4. Aktifkan Google login

Masih di Sign-in method:

1. pilih Google;
2. Enable;
3. pilih support email;
4. Save.

Login UI baru kita bangun di Patch 3. Patch 2 hanya menyiapkan provider.

## D5. Buat Firestore

Firebase Console:

```text
Firestore Database
→ Create database
```

Pilih **Production mode**.

Untuk lokasi, pilih Jakarta bila tersedia:

```text
asia-southeast2
```

Lokasi database sulit/mustahil dipindah seenaknya setelah dibuat, jadi periksa sebelum menekan Create.

## D6. Buat Firebase Admin credential

Firebase Console:

```text
Project settings (ikon gear)
→ Service accounts
→ Firebase Admin SDK
→ Generate new private key
```

Download JSON.

Cari tiga field:

```json
{
  "project_id": "...",
  "client_email": "...",
  "private_key": "..."
}
```

Masukkan ke `.env.local`:

```env
FIREBASE_PROJECT_ID=isi_project_id
FIREBASE_CLIENT_EMAIL=isi_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

PENTING:

- file JSON service account jangan dimasukkan ke project;
- jangan commit ke GitHub;
- jangan beri prefix `NEXT_PUBLIC_`;
- jangan mengirim private key ke orang lain.

Setelah nilai sudah dipindahkan ke password manager / `.env.local`, file JSON download boleh dipindahkan ke tempat aman atau dihapus dari Downloads.

## D7. Login Firebase CLI

Jalankan:

```powershell
npm run firebase:login
```

Browser terbuka. Login menggunakan akun yang memiliki project Kenangin.

Kemudian:

```powershell
npx firebase use --add
```

Pilih project Kenangin.

Kalau diminta alias, isi:

```text
default
```

## D8. Deploy Firestore Rules

Jalankan:

```powershell
npm run firebase:deploy
```

Patch sudah membawa:

```text
firebase.json
firestore.rules
firestore.indexes.json
```

Rules Patch 2 dibuat konservatif. Dashboard belum langsung dipindahkan ke Firestore karena Auth + ownership baru disambungkan di Patch 3.

## D9. Optional: Firebase Emulator

Untuk development lokal nanti:

```powershell
npm run firebase:emulators
```

Ini membantu testing Auth/Firestore tanpa terus menulis ke project cloud.

---

# E. Backblaze B2 — tanpa Cloudflare, tanpa public bucket

Kita hanya membuat **SATU PRIVATE BUCKET**. Backblaze saat ini mengizinkan mulai B2 tanpa kartu kredit dan memberi 10 GB storage pertama gratis. Tanpa CDN partner, egress gratisnya tetap terbatas (saat ini sampai 3× rata-rata storage bulanan), sehingga Cache Storage + IndexedDB kita pakai untuk mengurangi download ulang pada device yang sama.

Kenapa private?

- file Collector adalah data pribadi;
- theme/song juga tidak perlu public URL permanen;
- server bisa mengeluarkan presigned GET hanya ketika dibutuhkan;
- kita tidak perlu public bucket atau CDN.

## E1. Aktifkan Backblaze B2

1. Buka https://www.backblaze.com/
2. Login / buat akun.
3. Pastikan menu **B2 Cloud Storage** tersedia.

Jangan membuat Cloudflare account untuk proyek ini.

## E2. Buat satu private bucket

Masuk:

```text
B2 Cloud Storage
→ Buckets
→ Create a Bucket
```

Nama harus unik secara global. Contoh:

```text
kenangin-storage-vd-2026
```

Pilih privacy:

```text
Private
```

JANGAN pilih Public.

Untuk MVP:

- Object Lock: off;
- default encryption boleh dibiarkan default Backblaze;
- Lifecycle Rules belum perlu diubah sekarang.

Setelah bucket dibuat, masukkan:

```env
B2_BUCKET=kenangin-storage-vd-2026
```

## E3. Catat S3 Endpoint dan Region

Pada detail bucket, cari Endpoint.

Contoh:

```text
s3.us-east-005.backblazeb2.com
```

Maka `.env.local`:

```env
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005
```

Gunakan endpoint milik akunmu sendiri, jangan copy contoh di atas mentah-mentah.

## E4. Buat RUNTIME Application Key

Ini key yang nantinya dipakai Vercel/Next.js setiap hari.

Masuk:

```text
B2 Cloud Storage
→ Application Keys
→ Add a New Application Key
```

Nama:

```text
kenangin-runtime
```

Set:

```text
Allow Access to Bucket(s): pilih bucket Kenangin saja
Access Type: Read and Write
Allow List All Bucket Names: aktifkan jika pilihan tersedia
```

Jangan pakai file-name prefix karena aplikasi butuh beberapa prefix (`rooms/`, `theme-assets/`, dst.).

Create.

Backblaze menunjukkan:

```text
keyID
applicationKey
```

Application Key biasanya hanya diperlihatkan sekali.

Masukkan:

```env
B2_KEY_ID=isi_keyID
B2_APPLICATION_KEY=isi_applicationKey
```

Runtime key ini bucket-restricted, jadi lebih aman daripada memberi aplikasi akses ke seluruh account.

## E5. Buat TEMPORARY CORS setup key

Ada satu detail Backblaze yang penting:

- runtime key kita sengaja dibatasi ke satu bucket;
- tetapi operasi `PutBucketCors` membutuhkan capability `writeBuckets`;
- Backblaze tidak mengizinkan `writeBuckets` pada key yang bucket-restricted.

Karena itu kita membuat **setup key sementara**, hanya untuk satu kali konfigurasi CORS.

Application Keys → Add New Application Key.

Nama:

```text
kenangin-cors-setup-temp
```

PENTING: key ini **jangan dibatasi ke satu bucket**. Pilih scope account/All yang memungkinkan bucket settings diubah, dengan Read and Write/capability bucket-write sesuai UI akunmu.

Masukkan sementara ke `.env.local`:

```env
B2_SETUP_KEY_ID=...
B2_SETUP_APPLICATION_KEY=...
```

KEY INI TIDAK PERNAH DIMASUKKAN KE VERCEL.

## E6. Konfigurasi CORS otomatis

Pastikan `.env.local` minimal sudah berisi:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
B2_ENDPOINT=...
B2_REGION=...
B2_BUCKET=...
B2_SETUP_KEY_ID=...
B2_SETUP_APPLICATION_KEY=...
```

Lalu:

```powershell
npm run b2:cors
```

Target output:

```text
✓ B2 CORS configured: nama-bucket
  Allowed methods: GET, HEAD, PUT
  Origins:
    - http://localhost:3000
    - http://127.0.0.1:3000
```

Kenapa GET/HEAD/PUT?

- PUT = Collector upload langsung ke presigned URL;
- GET = Receiver/browser mengambil media melalui presigned URL;
- HEAD = metadata/status check.

Kalau muncul `AccessDenied`, hampir pasti setup key masih bucket-restricted atau tidak memiliki capability mengubah bucket/CORS.

## E7. HAPUS setup key

Setelah `npm run b2:cors` sukses:

1. kembali ke Backblaze → Application Keys;
2. cari `kenangin-cors-setup-temp`;
3. Delete/Revoke;
4. hapus nilainya dari `.env.local`:

```env
B2_SETUP_KEY_ID=
B2_SETUP_APPLICATION_KEY=
```

Yang tersisa adalah runtime key bucket-restricted.

## E8. Struktur folder tidak perlu dibuat manual

B2 object storage sebenarnya menggunakan key/prefix, jadi kita tidak perlu klik Create Folder satu per satu.

Kode nanti otomatis membuat key seperti:

```text
rooms/abc/raw/media123.jpg
theme-assets/imlek/background.webp
aura-assets/lightning/loop.webm
songs/hash123/track.mp3
```

---

# F. Browser Cache Foundation — Cache Storage + IndexedDB

Patch 2 sudah menambahkan:

```text
lib/browser-cache/
├── cache.ts
├── db.ts
├── policy.ts
├── types.ts
└── index.ts
```

Belum ada tombol/UI yang menggunakannya sekarang. Integrasi penuh terjadi saat Receiver dibangun.

## F1. Cara kerja cache

### Cache Storage

Menyimpan response file/media:

- photo;
- video kecil;
- theme background;
- ornament;
- Aura asset;
- song;
- beatmap.

### IndexedDB

Menyimpan metadata:

```text
cacheKey
kind
resourceId
roomId
contentType
sizeBytes
cachedAt
lastAccessedAt
expiresAt
version
```

Jadi IndexedDB bukan tempat blob besar.

## F2. Stable cache key

Presigned URL B2 selalu berubah dan expired.

Karena itu URL seperti ini:

```text
https://...backblazeb2.com/...?X-Amz-Signature=AAA
```

tidak digunakan sebagai identity cache.

Aplikasi memakai stable key seperti:

```text
rooms/abc/media/media123
```

Response dari presigned URL disimpan di Cache Storage menggunakan synthetic same-origin stable request.

Kunjungan berikutnya dapat membaca cache walaupun signed URL lama sudah expired.

## F3. Budget

Policy default foundation:

```text
maksimum absolut: 500 MB
atau
15% dari quota browser
ambil yang lebih kecil
```

Browser quota diperiksa dengan `navigator.storage.estimate()`.

## F4. Video besar

Foundation hanya persistent-cache video yang Content-Length-nya diketahui dan maksimal sekitar:

```text
25 MB
```

Video lebih besar nanti lebih cocok streaming normal dari presigned URL daripada dipaksa masuk persistent Cache Storage.

Nilai ini masih bisa dituning saat Patch Receiver/performance sudah punya data nyata.

## F5. Eviction

Cache manager menyediakan:

- expiry removal;
- LRU berdasarkan `lastAccessedAt`;
- budget enforcement;
- request persistent storage jika browser mengizinkan.

Browser tetap mempunyai keputusan terakhir atas storage perangkat user. Jangan menganggap local cache sebagai backup permanen; sumber kebenaran tetap B2.

---

# G. Gemini API

Gemini hanya digunakan server-side sebagai helper ringan.

Patch 2 menggunakan default text model:

```env
GEMINI_TEXT_MODEL=gemini-3.5-flash-lite
```

Image model disiapkan untuk tooling theme nanti:

```env
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
```

Patch 2 tidak menjalankan image generation.

## G1. Buat API key

1. Buka https://aistudio.google.com/
2. Masuk menggunakan akun Google.
3. Buka API Keys.
4. Create API key untuk Gemini Developer API.
5. Copy key.

Masukkan:

```env
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-3.5-flash-lite
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
GEMINI_TIMEOUT_MS=8000
```

Jangan beri prefix `NEXT_PUBLIC_` pada Gemini API key.

---

# H. Test infrastruktur dari lokal

Setelah Firebase, B2, dan Gemini selesai:

```powershell
npm run infra:check
```

Target:

```text
✓ Firebase Admin / Firestore
✓ Backblaze B2 private bucket: ...
✓ Gemini API (gemini-3.5-flash-lite)

Semua fondasi Patch 2 terhubung (B2 direct, tanpa Cloudflare).
```

Kalau salah satu merah, baca nama env/service yang disebut error. Jangan lanjut Vercel sebelum ini hijau kalau bisa.

---

# I. Seed Firestore development

Jalankan:

```powershell
npm run seed:dev
```

Akan diminta:

```text
Ketik "SEED" untuk lanjut:
```

Ketik:

```text
SEED
```

Ini memasukkan user/room dummy ke Firestore untuk development.

Dashboard belum membaca data ini. Itu disengaja sampai Patch 3 memasang Auth/session/owner authorization.

---

# J. Test project lokal

Jalankan:

```powershell
npm run dev
```

Buka:

```text
http://localhost:3000/dashboard
```

Dashboard harus tetap terlihat seperti sebelum Patch 2.

Buka juga:

```text
http://localhost:3000/api/health
```

Contoh struktur response:

```json
{
  "ok": true,
  "data": {
    "app": "kenangin",
    "status": "ok",
    "services": {
      "firebaseClient": true,
      "firebaseAdmin": true,
      "backblazeB2": true,
      "gemini": true
    },
    "mediaDelivery": {
      "origin": "backblaze-b2-private",
      "authorization": "presigned-url",
      "browserCacheFoundation": "cache-storage+indexeddb"
    }
  }
}
```

`/api/health` hanya memeriksa apakah env tersedia. Network test sesungguhnya dilakukan `npm run infra:check`.

---

# K. Git / GitHub

Sebelum commit:

```powershell
npm run check
git status
```

Pastikan ini TIDAK ikut commit:

```text
.env.local
service-account.json
```

Lalu:

```powershell
git add .
git commit -m "feat: patch 2 backend foundation"
git push
```

`package-lock.json` hasil `npm install` harus ikut commit jika berubah.

---

# L. Deploy ke Vercel

## L1. Import repository

1. Buka https://vercel.com/dashboard
2. Login dengan GitHub.
3. Add New → Project.
4. Import repository Kenangin.
5. Framework biasanya terdeteksi sebagai Next.js.
6. Production branch: `main`.

Push branch selain `main` akan menjadi Preview deployment; `main` menjadi Production.

## L2. Masukkan Environment Variables

Vercel project:

```text
Settings
→ Environment Variables
```

Masukkan nilai berikut untuk Production dan Preview sesuai kebutuhan.

Public Firebase/App:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Server-only:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
B2_ENDPOINT
B2_REGION
B2_KEY_ID
B2_APPLICATION_KEY
B2_BUCKET
GEMINI_API_KEY
GEMINI_TEXT_MODEL
GEMINI_IMAGE_MODEL
GEMINI_TIMEOUT_MS
SESSION_COOKIE_NAME
```

JANGAN masukkan:

```text
B2_SETUP_KEY_ID
B2_SETUP_APPLICATION_KEY
```

Setup key seharusnya sudah dihapus.

## L3. Deploy

Tekan Deploy.

Contoh production URL:

```text
https://kenangin.vercel.app
```

Setelah URL production sudah pasti, update Vercel env:

```env
NEXT_PUBLIC_APP_URL=https://kenangin.vercel.app
```

Redeploy.

---

# M. Tambahkan Vercel domain ke Firebase Auth

Firebase Console:

```text
Authentication
→ Settings
→ Authorized domains
```

Tambahkan hostname production, contoh:

```text
kenangin.vercel.app
```

Pastikan localhost tetap tersedia untuk development.

---

# N. Update B2 CORS untuk Production URL

CORS sebelumnya hanya localhost. Browser production juga perlu diizinkan.

Karena temporary setup key tadi sudah dihapus, buat lagi temporary unrestricted CORS key seperti bagian E5.

Di `.env.local` sementara:

```env
NEXT_PUBLIC_APP_URL=https://kenangin.vercel.app
B2_SETUP_KEY_ID=...
B2_SETUP_APPLICATION_KEY=...
```

Jalankan:

```powershell
npm run b2:cors
```

Setelah sukses:

1. delete/revoke temporary key lagi;
2. kosongkan `B2_SETUP_*` dari `.env.local`;
3. untuk local development, `NEXT_PUBLIC_APP_URL` boleh dikembalikan ke `http://localhost:3000`.

Script selalu mempertahankan `http://localhost:3000` dan `http://127.0.0.1:3000`, jadi local development tetap jalan setelah CORS production dipasang.

Untuk Preview deployment, masukkan URL preview tertentu ke `B2_CORS_EXTRA_ORIGINS` jika preview tersebut memang perlu mengakses B2 langsung. Tidak perlu membuka semua origin.

---

# O. Checklist selesai Patch 2

Selesaikan checklist ini:

- [ ] Node.js 22 terpasang.
- [ ] `npm install` selesai.
- [ ] `npm run check` lulus.
- [ ] `.env.local` dibuat dan tidak masuk Git.
- [ ] Firebase project dibuat.
- [ ] Firebase Web App dibuat.
- [ ] Email/password provider aktif.
- [ ] Google provider aktif.
- [ ] Firestore dibuat di region yang dipilih.
- [ ] Firebase Admin env terisi.
- [ ] Firestore Rules ter-deploy.
- [ ] Satu B2 bucket PRIVATE dibuat.
- [ ] Runtime B2 app key bucket-restricted dibuat.
- [ ] B2 CORS localhost terpasang.
- [ ] Temporary CORS setup key sudah dihapus.
- [ ] Gemini API key terisi.
- [ ] `npm run infra:check` hijau.
- [ ] `npm run seed:dev` berhasil bila ingin seed cloud dev.
- [ ] Dashboard lokal tetap normal.
- [ ] `/api/health` normal.
- [ ] Repository sudah masuk Vercel.
- [ ] Env production Vercel terisi.
- [ ] B2 CORS production domain terpasang.
- [ ] Firebase Authorized Domains berisi domain Vercel.

Kalau semua sudah centang, Patch 2 dianggap selesai.

Patch 3 baru akan mengaktifkan Firebase Auth/session, mengganti profil dummy, dan memindahkan Dashboard/Room CRUD dari mock repository ke data nyata.

---

# Referensi resmi

- Firebase Auth Web: https://firebase.google.com/docs/auth/web/start
- Firestore Locations: https://firebase.google.com/docs/firestore/locations
- Firebase Admin Node release notes: https://firebase.google.com/support/release-notes/admin/node
- Vercel Git deployments: https://vercel.com/docs/git
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Backblaze S3-Compatible API: https://www.backblaze.com/docs/cloud-storage-s3-compatible-api
- Backblaze S3 App Key capabilities: https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys
- Backblaze CORS: https://www.backblaze.com/apidocs/s3-put-bucket-cors
- Gemini 3.5 Flash-Lite: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- Gemini image generation: https://ai.google.dev/gemini-api/docs/image-generation
- MDN Cache.put(): https://developer.mozilla.org/en-US/docs/Web/API/Cache/put
- MDN IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- MDN StorageManager: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager
