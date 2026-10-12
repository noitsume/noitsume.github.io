# Musik milik pengguna

Perubahan rencana 10 Oktober 2026: Kenangin tidak lagi menyediakan katalog
soundtrack bawaan maupun alat komposisi/blending otomatis di proyek utama.
Pemilik Room mengunggah soundtrack atau musik latar yang ia pilih/buat sendiri.

Alur yang tersedia: **pilih MP3 → unggah → Siapkan beatmap → gunakan →
Pratinjau & Suasana**. Batas unggahan 30 MB dan 20 menit. Penyiapan membaca
energi dan irama file; tidak menciptakan lagu baru dan tidak memanggil model AI.

- Musik Soundtrack opsional mengiringi Room secara kontinu dan menggerakkan Aura latar.
- Musik Section opsional dipilih per section, bisa memakai ulang unggahan yang sama,
  dan menggerakkan Aura depan. Saat kembali ke section, lagunya dimulai dari awal.
  Jika lagu yang dipilih sama dengan soundtrack, satu pemutaran diteruskan agar tidak bergaung.
- Volume soundtrack dan setiap section dapat diatur 0–100% secara terpisah. Jika
  keduanya memilih lagu yang sama, volume section berlaku selama section aktif.
  Volume 0 pada musik section yang berbeda tidak mengecilkan soundtrack.
- Video dan musik section dimulai setelah watermill berhenti di tengah, dijeda selama
  perpindahan. Soundtrack tetap berjalan kontinu.
- Suara video yang benar-benar sedang berbunyi mengecilkan kedua musik. Jika
  hanya musik section yang berbunyi, soundtrack latar mengecil tanpa mengulang posisinya.
- Satu tombol penerima menjeda kedua musik. Berpindah tab menjeda seluruh audio/video;
  pengguna mengaktifkan kembali musik melalui tombol tersebut.
- Aura menggunakan energi atau beat yang diperhalus, dengan perubahan cahaya kecil.
  Tidak ada strobe atau guncangan teks. Gerakan mengikuti preferensi reduced motion
  dan dapat dijeda oleh penerima.

Detail model section, migrasi, serta pratinjau ada di [Studio authoring](studio-authoring.md).

Pilihan katalog sudah dihapus dari UI, validasi request, director, dan proses
penerbitan baru. Skrip npm `music:*` dan `songs:analyze`, alat Python pembuat
katalog, riset, sampel, serta audio eksperimen hanya tersedia dalam arsip.

Draf lama yang memilih katalog dibaca dengan pilihan musik dan gaya cerita
dikosongkan; media, trim video, tema, petunjuk cerita, serta versi draf tetap
dipertahankan. Hal yang sama berlaku pada pilihan belum tersimpan di tab.
Pengguna dapat memilih musik sendiri atau melanjutkan tanpa musik sebelum menerbitkan ulang.

Snapshot Receiver yang sudah terbit tetap dapat dibaca. File statis lama
di `public/creative/songs` dipertahankan untuk URL yang sudah tersimpan pada
snapshot tersebut; file ini tidak lagi ditawarkan sebagai katalog. Tidak ada
migrasi atau penghapusan data Firebase/B2 yang dijalankan untuk perubahan ini.

## Arsip sebelum perubahan

`C:/Portofolio/Legacy/kenangin-soundtrack-2026-10-10`

Salinan diverifikasi sebelum penghapusan di proyek utama: **60.588 file,
3.863.246.790 byte, seluruh SHA-256 cocok**. Empat junction cache Next.js
dikecualikan; cache itu dapat dibangun ulang. Arsip mencakup Git, konfigurasi
lokal, dependensi, dan seluruh hasil audio eksperimen.
Petunjuk ada di `ARCHIVE.md`, bukti lengkap di `ARCHIVE-VERIFICATION.json`.

```powershell
cd C:/Portofolio/Legacy/kenangin-soundtrack-2026-10-10
npm run music:preview
```

Arsip kode masih memiliki konfigurasi backend yang sama; arsip tersebut bukan
duplikasi database atau bucket. Proyek aktif tetap
`C:/Portofolio/project/kenangin`, dijalankan dengan `npm run dev`.

## Verifikasi penghapusan katalog (sebelum editor section)

- Arsip sebelum perubahan: 17/17 tes aplikasi lulus.
- Proyek utama: 22/22 tes aplikasi lulus, termasuk penolakan pilihan katalog,
  pemulihan draf/tab lama, dan pembacaan snapshot cerita yang sudah terbit.
- `npm run lint` dan `npm run build` berhasil pada Node 24.18.0. Build diulang
  di luar sandbox karena SWC Windows tidak dapat melakukan canonicalize path
  proyek di dalam sandbox; deklarasi runtime proyek tetap Node 22.x.
- Tidak ada git push, deploy, atau perubahan data backend dalam pekerjaan ini.
