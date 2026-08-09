# Patch 3 Hotfix — Vercel Firebase Admin ESM Runtime

## Error yang diperbaiki

Vercel runtime gagal pada `/`, `/login`, dan route server lain dengan error:

`ERR_REQUIRE_ESM: require() of ES Module .../jose/dist/webapi/index.js from .../jwks-rsa/src/utils.js not supported`

## Root cause

Project memakai `firebase-admin@14.2.0`. Firebase Admin v14 menaikkan dependency `jwks-rsa` ke 4.x, sedangkan `jwks-rsa` 4 menggunakan `jose` 6 (ESM-only). Pada runtime Next.js/Vercel, `firebase-admin` adalah salah satu server package yang dieksternalkan, sehingga jalur CommonJS dapat mencoba `require()` dependency ESM tersebut.

## Fix

Pin:

```json
"firebase-admin": "13.10.0"
```

Versi 13.10.0 masih mencakup API Auth/Firestore yang dipakai Kenangin dan menggunakan `jwks-rsa` 3.x.

## Setelah extract

Jalankan:

```bash
npm install
npm run check
npm run infra:check
```

Pastikan `package-lock.json` berubah dan commit file tersebut bersama `package.json`.

Setelah push, Vercel akan melakukan deployment baru. Uji:

- `/api/health`
- `/login`
- `/register`
- `/`
- login Google/email

