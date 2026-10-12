# Kenangin.id

Simbol K terdiri dari punggung album dan dua lembar yang terbuka. Bentuk membulat dan warna terakota mengikuti identitas ruangan kenangan yang hangat di aplikasi.

## Aset

- `kenangin-logo.svg`: logo lengkap untuk latar terang, tanpa latar belakang.
- `kenangin-logo-light.svg`: logo lengkap untuk latar gelap, tanpa latar belakang.
- `kenangin-logo-mono.svg`: versi satu warna (`currentColor`; hitam jika dibuka sendiri).
- `kenangin-mark.svg`: simbol K tanpa tulisan.
- `kenangin-logo.png`: ekspor transparan, 1150 × 240.
- `kenangin-icon.png`: ikon persegi 512 × 512.

Gunakan logo utuh tanpa merenggangkan rasio, memutar, atau menambah bayangan. Sisakan ruang kosong minimal selebar punggung album pada simbol. Untuk ruang sempit, gunakan simbol K, bukan mengecilkan tulisan sampai tidak terbaca.

Warna: terakota `#B94E3C`, peach `#F29B82`, tinta `#30231E`, krem `#FFFAF5`. Pada halaman penerima, logo mengikuti warna teks tema agar tetap serasi dengan Room.

## Implementasi

Sumber geometri ada di `config/brand-artwork.json`; simbol dan tulisan sama-sama berupa path vektor. Tulisan disusun dari Segoe UI Semibold dan Segoe UI lalu diubah menjadi outline, sehingga tidak memerlukan font atau layanan eksternal saat ditampilkan.

Komponen `components/brand/brand-logo.tsx` memakai geometri yang sama untuk header, autentikasi, Collector, dan penerima. Komponen bersifat dekoratif; tautan pembungkusnya harus mempunyai `aria-label`. Tulisan tetap terlihat di halaman masuk dan Collector pada ponsel; header aplikasi dan toolbar penerima menggunakan simbol saja ketika ruang sempit.

Setelah mengubah geometri, ekspor ulang dengan dependensi project terpasang:

```sh
node scripts/generate-brand-assets.mjs
```

Generator juga memperbarui `app/icon.svg`, `app/favicon.ico` (16, 32, 48 px), dan `app/apple-icon.png` (180 px). Next.js memasangnya melalui konvensi metadata file. Perubahan ini tidak memerlukan pembaruan database.
