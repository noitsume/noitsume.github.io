# Studio: section milik pemilik Room

Alur aktif: **Momen → Atur Cerita → Musik → Pratinjau & Suasana → tinjauan penerbitan**.
Petunjuk menjadi checkbox **Beri penekanan** di setiap section. Pilihan tiga gaya AI
tidak lagi menjadi syarat penerbitan.

## Perilaku editor

- Draf baru dimulai dengan section kosong. **Tambahkan section** menyediakan Main Video,
  Main Photo, Slider Video, Slider Foto, dan Teks. Jenis yang sama boleh ditambahkan lagi.
- Main memiliki satu slot; slider 1–5 media dengan jenis yang sama; Teks tidak memiliki
  media. Draf dengan slot kosong tetap dapat disimpan, tetapi pratinjau/publikasi meminta
  slot diisi atau section dihapus. Section Teks memerlukan isi. Maksimal 80 section.
- Maksimal 100 media dipilih di Momen. Thumbnail membawa ID inventori saat diseret;
  pemilih **Isi slot** menyediakan jalur tanpa drag untuk ponsel dan keyboard.
- Media boleh dipakai ulang pada section berbeda. Volume, trim, loop, dan fit melekat
  pada media, berlaku di semua pemakaiannya. Keterangan dan musik melekat pada section.
- Hanya media yang sudah ditempatkan ditampilkan di Receiver. Media pilihan yang belum
  ditempatkan tetap berada dalam draf dan inventori, tanpa dihapus.
- **Rekomendasikan dong** menyusun video individual dan foto berurutan dalam kelompok
  maksimal lima. Mengganti susunan yang ada meminta konfirmasi agar keterangan tidak hilang.
- Teks keterangan maksimal 2.000 karakter dan mempertahankan baris baru. Semua media
  memakai keterangan bersama section, ditempatkan di bawah tengah media.
- Perubahan lokal dipulihkan dari sessionStorage hanya ketika versi server cocok.
  Penyimpanan server memakai pemeriksaan versi dan transaksi yang sudah ada untuk
  mencegah tab lama menimpa draf atau publikasi baru.
- Header dapat dilipat melalui chevron di bawah tengahnya. Tray media sticky memakai
  tinggi header aktual (termasuk tombol), sehingga mengikuti perubahan ukuran/lipat.
  Penyesuaian tampilan berikutnya memperkecil tombol menjadi 40 × 10 px. Latar tray
  memakai transparansi 50% tanpa memudarkan thumbnail/teks; sudut wadah keterangan
  pratinjau memakai radius 18 px.

## Suasana dan pemutaran

Preset Tenang, Berwarna, dan Energik mengisi intensitas Aura, respons energi/beat,
gerakan watermill/lembut/tanpa gerakan, serta Aura latar. Pengguna dapat mengganti
masing-masing kontrol. Section dapat memakai override sendiri; tanpa override,
checkbox penekanan menaikkan intensitas Lembut menjadi Sedang.

Pratinjau dan Receiver memakai komponen yang sama. Satu gestur wheel/swipe memilih satu
section, lalu watermill berhenti dengan section tepat di tengah area cerita. Selama
perpindahan, semua video dan musik section dijeda; pemutaran baru diizinkan pada frame
setelah posisi tengah tercapai. Tombol dan keyboard memakai pengendali yang sama;
navigasi baru membatalkan transisi sebelumnya. Teks/keterangan panjang dapat digulir
di dalam section tanpa mengganti section. Beat tidak menggerakkan teks.

Musik opsional. Soundtrack berjalan kontinu. Musik section mulai saat fokus, dilepas
saat ditinggalkan, dan mulai ulang ketika kembali. Jika section memilih lagu yang sama
dengan soundtrack, satu transport musik diteruskan untuk mencegah gema dua pemutaran.
Volume 0–100% tersimpan per pilihan soundtrack/section (`volume` 0–1); field lama yang
tidak memilikinya memakai 100%. Nilai mengatur level sebelum ducking. Lagu yang sama
dengan soundtrack memakai volume section saat fokus, kembali ke volume soundtrack
saat ditinggalkan, tanpa mereset posisi. Musik section bervolume 0 tidak mengecilkan
soundtrack latar. Nilai ikut tersimpan dalam preview dan snapshot publikasi.
Prioritas suara: video terdengar →
musik section → soundtrack. Pengurangan volume mengikuti peristiwa pemutaran aktual,
bukan sekadar keberadaan file video. Bagian berikutnya tidak dapat memulai musik setelah
pengguna sudah menggulir melewatinya. Reduced motion dan tombol jeda menghilangkan gerakan
yang tidak perlu. Efek berupa cahaya beramplitudo kecil yang diperhalus, bukan strobe.

## Kontrak dan publikasi

Versi envelope Studio/ExperienceDNA/Receiver tetap 1 untuk pembacaan snapshot lama.
Editor baru ditandai `authoringVersion: 2`. Field tambahan bersifat opsional pada pembacaan
format lama. Saat membuka draf lama, arah terpilih dipindahkan menjadi section yang dapat
diedit, dengan urutan/keterangan dipertahankan dan album besar dibagi menjadi kelompok lima.
Snapshot publik tidak berubah sebelum pengguna menerbitkan revisi.

`PATCH /api/rooms/[id]/studio/settings` menerima `sectionPlan`, `atmosphere`, dan
`preparePreview`. Server memvalidasi kepemilikan media/musik, jenis slot, identitas section,
dan kesiapan analisis musik. Kompilasi deterministik mempertahankan pilihan pemilik;
tidak menambahkan hero atau meminta Gemini mengubah urutan/keterangan.

`GET /api/rooms/[id]/studio/preview` memerlukan sesi pemilik. Menghasilkan manifest privat
dan URL aset sementara, tanpa publikasi, penulisan B2, cache persisten foto pratinjau,
atau event analitik penerima. **Muat ulang pratinjau** memperbarui URL jika kedaluwarsa.
Penerbitan memakai pembangun manifest yang sama, kemudian memverifikasi ukuran file B2
dan menulis snapshot secara atomik melalui repository Receiver yang sudah ada.

Musik section dideduplikasi menurut ID lagu. Saat terbit, beatmap disimpan sebagai JSON
privat di `rooms/<room>/music/beatmaps/<musicId>/<hash-analisis>.json`, sehingga banyak
lagu tidak menggandakan ribuan beat di dokumen Firestore. Hash membuat timeline revisi
lama tidak ikut berubah. File beatmap memerlukan izin B2 `writeFiles` yang sudah digunakan
untuk penulisan aset. Musik yang masih dipakai draf atau snapshot aktif tidak dapat dihapus.

## Verifikasi

Tes kontrak/service mencakup draf kosong, slot salah jenis, batas slider, ID asing,
migrasi album lama, caption/order tetap, media belum ditempatkan, musik per section,
cerita teks tanpa musik, dan guard penghapusan musik. Publikasi/preview diuji dengan
repository dan B2 terisolasi; pengujian tidak menulis data produksi.

QA browser memakai komponen sebenarnya dan respons API fixture lokal, termasuk unggah
MP3 sintetis, analisis beatmap aktual di browser, pemulihan draf setelah reload,
slider video, prioritas suara, navigasi cepat, serta layout desktop dan ponsel.
Fixture dan aset QA dihapus dari app/public sebelum build produksi.

Hasil pemeriksaan awal editor 10 Oktober 2026: **42/42 tes lulus**, `npm run lint` tanpa
peringatan, `npm run typecheck` dan `npm run build` berhasil. QA Edge mencakup
1365 px, 390 px, dan 320 px; tidak ada exception JavaScript pada skenario yang
lulus. Deduplikasi lagu latar/section, kestabilan teks, reduced motion, urutan
hasil edit, dan pembatalan rekomendasi juga diperiksa. Tes ini menggunakan
fixture lokal dan adapter backend; tidak menerbitkan Room atau menulis data produksi.

## Pembaruan header, volume, navigasi, dan loading

Verifikasi lanjutan 10 Oktober 2026: **45/45 tes lulus**, lint tanpa peringatan,
serta build produksi berhasil (termasuk pemeriksaan TypeScript). Halaman/aset QA
sudah dihapus; tipe dev Next yang masih merujuk halaman QA juga dibersihkan.

- Edge desktop 1365 px serta ponsel 390/320 px: header terbuka/lipat, tray tidak
  tertutup, kontrol volume tidak meluap. Uji awal memakai tombol 44 px; pemeriksaan
  setelah revisi ukuran mengonfirmasi tinggi tombol 10 px pada desktop dan ponsel.
- Wheel beruntun, wheel asli di atas video, swipe sentuh, tombol, serta keyboard:
  satu section berhenti tepat di tengah. Semua event `playing` video/musik section
  yang diamati memiliki selisih pusat 0 px dan status navigasi sudah selesai.
- Soundtrack tetap berjalan selama perpindahan; volume terpisah, volume 0,
  pemakaian lagu yang sama, navigasi cepat, teks panjang, dan reduced motion lulus.
- Form login dan onboarding asli diuji dengan respons Firebase/API simulasi.
  Masing-masing melakukan satu mutasi sesi/profil dan navigasi dokumen baru;
  pengujian ini tidak memverifikasi kredensial atau cookie Firebase produksi.
- Bar loading diukur selama tiga putaran: bergerak penuh ke kanan tanpa lompatan
  balik di tengah; reduced motion memakai indikator diam. CSS yang sama dipakai
  halaman loading dan proses penerbitan.

Login/onboarding tidak lagi melakukan prefetch halaman privat sebelum sesi/profil
siap. Setelah mutasi cookie/profil selesai, satu `location.replace` memakai tujuan
lokal yang sudah divalidasi. Ini menghindari penggunaan redirect pra-login dari
Router Cache serta perlombaan `router.replace` dengan `router.refresh`. Konsekuensinya
adalah satu pemuatan dokumen penuh pada batas autentikasi, sementara navigasi biasa
Studio tetap memakai router. Logout memakai batas navigasi yang sama.
