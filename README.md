This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Musik untuk Room sekarang berasal dari MP3 yang diunggah pemilik. Katalog
soundtrack bawaan dan eksperimen komposisi/blending telah dipindahkan ke
arsip Legacy. Lihat [kebijakan musik dan lokasi arsip](docs/music-policy.md).

Studio memakai empat langkah: **Momen → Atur Cerita → Musik → Pratinjau & Suasana**.
Susunan section manual, musik per section, kompatibilitas draf lama, dan aturan
pemutaran dijelaskan di [Studio authoring](docs/studio-authoring.md).

Gunakan Node.js 22 sesuai `.nvmrc`. Pada checkout baru atau jika executable
`next`/`tsc` hilang dari `node_modules`, pulihkan dependency dengan `npm ci`.
Perintah ini mengikuti `package-lock.json`; tidak perlu menghapus lockfile.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Port development ditetapkan ke **3000**, sesuai origin yang diizinkan CORS
Backblaze B2. Jika port sedang dipakai, hentikan server lokal sebelumnya dengan
`Ctrl+C`, lalu jalankan `npm run dev` lagi. Server tidak akan otomatis bergeser
ke 3001: bagi browser, `localhost:3000` dan `localhost:3001` adalah origin berbeda.

Jika sengaja memakai port atau domain lain, tambahkan origin lengkapnya ke
`B2_CORS_EXTRA_ORIGINS` di `.env.local`, lalu terapkan dengan `npm run b2:cors`
menggunakan setup key yang sesuai. Mengubah `.env.local` saja tidak memperbarui
aturan bucket. Respons `201` dari API `upload-urls` hanya menyiapkan URL;
upload browser masih memerlukan preflight `OPTIONS` dan `PUT` yang lolos CORS.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
