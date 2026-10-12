# Audit state Kenangin — 10 Oktober 2026

**Kesimpulan: implementasi sudah melewati baseline Patch 7, mengikuti perubahan produk terbaru, tetapi belum memenuhi seluruh gerbang selesai masterplan. Fokus berikutnya adalah penyelesaian Patch 10–11 dan penyelarasan dokumen, bukan memulai Patch 8.**

Audit memakai working tree `C:/Portofolio/project/kenangin`, branch `main`, HEAD `56d9feb`, termasuk perubahan dan file baru yang belum di-commit. Referensi awal ialah roadmap “12 Patch (Adjusted after Patch 7)” di Downloads. Keputusan pengguna pada chat **Analisis project saat ini**, khususnya perubahan musik dan editor pada 10 Oktober, diperiksa kembali terhadap kode. Instruksi implementasi dalam roadmap diperlakukan sebagai kriteria perbandingan, bukan perintah menjalankan patch selama audit.

Pemeriksaan mencakup kode, 45 tes, lint, TypeScript, build, koneksi layanan, metadata Firestore/B2, pemeriksaan HTTP localhost, dan dua reproduksi lokal. Audit tidak mengubah data Firestore/B2, menjalankan penghapusan, push, atau deploy. Berkas laporan ini merupakan hasil audit; tidak ada perbaikan fitur yang diterapkan.

## Posisi terhadap roadmap

| Patch | Penilaian sekarang | Bukti dan batasnya |
| --- | --- | --- |
| 0–3: fondasi, dashboard, backend, auth, Room CRUD | Fondasi dan alur inti tersedia | Next.js 16.2.12, TypeScript strict, repository Firestore, owner session, CSRF, route dashboard/Room. API owner tanpa sesi mengembalikan 401; mutasi tanpa CSRF ditolak 403. Bukan pengujian ulang seluruh UI CRUD. |
| 4–5: Collector, moderasi, Media Intelligence | Implementasi inti tersedia | Staging contributor, promosi ke inventori permanen, unggahan owner, proxy browser, Quick Look/Deep dan fallback. Tes moderasi/retry lulus. Backend berisi 18 media dengan analisis ready dan 2 fallback; benchmark perangkat fisik belum ditutup. |
| 6: creative catalogs | Tersedia dengan perubahan scope musik yang disengaja | 5 tema, 9 Aura, 4 transisi; integrity check lulus, 15 aset tema publik ditemukan. Katalog lagu/generator sudah dihentikan atas permintaan pengguna; MP3 pengguna menggantikannya. |
| 7: Studio dan direction | Diganti oleh desain authoring terbaru | Momen → Atur Cerita → Musik → Pratinjau & Suasana. Pemilik mengatur section, teks, penekanan, suasana, soundtrack dan musik section. Kompilasi ExperienceDNA deterministik menggantikan pemilihan tiga direction AI pada alur aktif. |
| 8: Bake, snapshot, delivery | Milestone inti terimplementasi | Publikasi transaksi, revision bertambah, receiverId tetap, pengecekan aset B2, resolver berdasarkan daftar aset manifest. Tes race/draf usang/re-bake lulus; Receiver QA revision 2 dapat dibaca melalui HTTP. Masih ada batas ukuran dokumen yang belum dijaga. |
| 9: Receiver | Runtime utama tersedia; tidak identik dengan seluruh rancangan lama | Controller navigasi tunggal, watermill, video/slider/teks, soundtrack kontinu, musik section, ducking, wishes, reduced motion, retry aset. Ambient media pool dari rancangan lama tidak ditemukan pada runtime sekarang; authoring baru memakai suasana dan glow umum, bukan seluruh choreography catalog asli. |
| 10: analytics, cache, lifecycle | Sebagian besar fondasi tersedia, lifecycle belum lengkap | Agregat harian/idempotensi, cache foto dan beatmap dengan key revision, LRU/expiry, pemuatan media sekitar section aktif, teardown version-aware. Sweeper hanya mencakup staging milik Room yang masih ada. |
| 11: hardening dan produksi | Belum boleh ditandai selesai | Tes lokal dan pemeriksaan dasar layanan/API lulus. Belum ada bukti QA perangkat fisik, E2E layanan nyata untuk editor terbaru, benchmark performa lengkap, dan verifikasi deployment terbaru. Ada celah upload dan ukuran snapshot yang terkonfirmasi. |

Sumber implementasi: [backend provider](C:/Portofolio/project/kenangin/lib/data/providers/backend-repository-provider.ts), [Studio](C:/Portofolio/project/kenangin/lib/studio/service.ts), [publication](C:/Portofolio/project/kenangin/lib/receiver/service.ts), [runtime Receiver](C:/Portofolio/project/kenangin/components/receiver/receiver-experience.tsx), [analytics](C:/Portofolio/project/kenangin/lib/receiver/analytics.ts).

## Perubahan masterplan yang memang disetujui

1. **Musik berasal dari pengguna.** Katalog tiga lagu, generator, dan blending tidak lagi menjadi deliverable proyek aktif. File lagu statis lama tetap ada demi snapshot yang sudah terbit. [Kebijakan musik](C:/Portofolio/project/kenangin/docs/music-policy.md:3).
2. **Pemilik menyusun cerita.** Main Photo/Video, slider maksimal lima media, dan teks menggantikan aturan lama “setiap video satu section, seluruh foto satu album”. Media yang dipilih tetapi belum ditempatkan tidak dimasukkan Receiver. Ini perubahan kontrak produk yang diminta pengguna, bukan kehilangan media secara tidak sengaja. [Kontrak authoring](C:/Portofolio/project/kenangin/docs/studio-authoring.md:3).
3. **Petunjuk dan tiga gaya AI bukan gate wajib.** Penekanan melebur ke section; preview memakai pemutar yang sama dengan Receiver. `getRoomStudioConfig()` memigrasikan draf lama ke authoring v2, dan jalur generate v2 langsung memanggil compiler deterministik. Wish Intelligence dan Gemini Director lama masih ada di source tetapi tidak dijalankan pada alur authoring aktif. Gemini tetap dipakai untuk Media Intelligence. [Migrasi](C:/Portofolio/project/kenangin/lib/studio/authoring.ts:43), [jalur generate](C:/Portofolio/project/kenangin/lib/studio/service.ts:463).
4. **Audio dua lapis.** Soundtrack kontinu dan musik section memiliki volume terpisah; video yang bersuara mendapat prioritas. Ini memperluas konsep background music kontinu, bukan menghilangkannya.

Karena itu, roadmap lama tidak lagi tepat sebagai daftar penerimaan literal untuk Patch 6–7. Arah arsitektur besarnya tetap: satu repo, Next.js, Firebase, private B2, proxy browser, publikasi deterministik, website Receiver, tanpa render video final atau worker terpisah.

## Hasil verifikasi pada sesi ini

| Pemeriksaan | Hasil |
| --- | --- |
| `npm test` | **45/45 lulus**, tanpa skip. Tes memakai source TypeScript aktual dan adapter/stub terisolasi untuk layanan. |
| Lint dan TypeScript | Lulus melalui tahap awal `npm run check`. |
| Build produksi | Lulus melalui `npm run build` di luar sandbox. Percobaan pertama gagal karena SWC Windows tidak dapat melakukan canonicalize path di sandbox, bukan error kode. |
| Runtime pengujian | Node **24.18.0**. `package.json` menetapkan **22.x**; hasil Node 22 pada dokumentasi 8 Oktober adalah bukti historis, bukan pengujian ulang revisi terbaru. |
| Firebase/B2/Gemini | `infra:check` lulus setelah akses jaringan diberikan. Firestore dapat dibaca, B2 HeadBucket berhasil, satu health request `gemini-3.8-flash` merespons dalam 6,6 detik. Ini tidak mengukur kualitas analisis multimodal. |
| Catalog | 5 tema, 9 Aura, 4 transisi; integrity OK; 15/15 aset tema publik ada. |
| HTTP localhost | `/api/health` 200; `/api/rooms` tanpa sesi 401; POST Bake tanpa CSRF 403. |
| Receiver QA | Manifest 200, revision 2, 3 section. Tidak ada field bernama `ownerUid`, `ownerEmail`, `storageObjectKey`, `apiKey`, atau `prompt` pada manifest yang diperiksa. |
| Resolver aset | ID aset yang tidak terdaftar: 404. Aset privat terdaftar: redirect 307 dengan URL kedaluwarsa 300 detik dan `Cache-Control: private, no-store`. Tidak mengambil isi file. |

Pemeriksaan backend menggunakan konfigurasi `.env.local`; ini membuktikan kondisi layanan yang terhubung, bukan kesamaan deployment Vercel dengan working tree.

| Metadata backend | Hasil |
| --- | --- |
| Room | **13**: 6 ready, 3 configuring, 2 collecting, 2 closed. |
| Studio tersimpan | 8 draf authoring v1, 1 v2; seluruh 9 draf lolos schema baca saat ini. Room lainnya belum memiliki Studio tersimpan. |
| Media permanen | 20: 18 analysis ready, 2 fallback. |
| Submission | 9, semuanya approved. |
| Musik unggahan | 4, semuanya analysis ready. |
| Snapshot Receiver | 8 snapshot terhubung ke Room; 0 snapshot hilang dan 0 gagal schema envelope. Ada 59 asset records serta 3 dokumen analytics harian. |
| B2 prefix `rooms/` | 26 object versions, 0 delete marker, total **25.333.323 byte**; pemindaian selesai dalam satu halaman. |
| File yatim yang diperiksa | 0 versi dengan parent Room tidak ditemukan; 0 objek tidak tereferensi yang berumur lebih dari 72 jam. Referensi mencakup inventori, staged submissions, musik, dan aset snapshot aktif. |

Jumlah snapshot lebih banyak daripada Room ready tidak otomatis merupakan anomali: snapshot lama tetap disimpan saat pemilik membuka kembali Studio. Audit schema envelope tidak membuktikan setiap codec dapat diputar atau setiap file sudah diverifikasi byte per byte. Pemindaian retensi juga tidak menyimpulkan bahwa semua objek yang lebih muda dari 72 jam sudah di-commit.

## Temuan yang perlu ditutup

**P1 — Ukuran upload tidak terikat pada presigned PUT.**

Validasi dan kuota memakai `sizeBytes` dari request, tetapi pembuat URL tidak menerima ukuran tersebut. Probe lokal terhadap fungsi sebenarnya, dengan kredensial dummy dan tanpa mengunggah apa pun, menghasilkan `X-Amz-SignedHeaders=content-type;host`, `UNSIGNED-PAYLOAD`, expiry 900 detik, tanpa ikatan panjang payload. Verifikasi HEAD saat commit baru berjalan setelah file masuk B2. Akibatnya, angka kuota di API tidak menjadi batas keras untuk byte yang dapat masuk lewat URL itu; upload yang tidak di-commit tetap memakai storage.

Lokasi: [presigner](C:/Portofolio/project/kenangin/lib/storage/b2.ts:64), [reservasi kuota](C:/Portofolio/project/kenangin/lib/collector/service.ts:160), [verifikasi setelah upload](C:/Portofolio/project/kenangin/lib/collector/service.ts:278).

Prioritas perbaikan: bawa ukuran tervalidasi sampai kontrak PUT yang ditandatangani, lalu buktikan B2 menolak ukuran berbeda dan browser mengirim ukuran yang benar. Tetap pertahankan pemeriksaan HEAD, penanganan URL yang dapat dipakai ulang, dan cleanup versi. Presigned URL bukan token sekali pakai; sifat reuse ini dijelaskan dalam [dokumentasi resmi S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), dan B2 memakai [API kompatibel S3](https://www.backblaze.com/docs/cloud-storage-call-the-s3-compatible-api). Perilaku penolakan ukuran belum diuji dengan PUT nyata pada audit ini.

**P2 — Sweeper belum mencakup seluruh jalur unggahan.**

Maintenance mengambil maksimal 200 Room yang masih ada, lalu hanya memindai `rooms/<id>/submissions/`. Padahal owner langsung mengunggah ke `media/`, dan musik ke `music/`. Jika tab ditutup setelah PUT sebelum commit pada dua jalur itu, file tidak akan ditemukan sweeper saat ini. Upload yang selesai setelah parent Room dihapus juga berada di luar jangkauannya. Belum ada scheduler yang dipasang oleh repo; audit tidak membuktikan ada atau tidaknya scheduler eksternal.

Lokasi: [batas scan](C:/Portofolio/project/kenangin/scripts/maintenance.mjs:34), [prefix yang dipindai](C:/Portofolio/project/kenangin/scripts/maintenance.mjs:62), [unggahan owner](C:/Portofolio/project/kenangin/lib/collector/service.ts:172), [unggahan musik](C:/Portofolio/project/kenangin/lib/studio/service.ts:288).

Perlu rekonsiliasi seluruh namespace dengan masa tenggang dan perlindungan referensi draf/snapshot, termasuk pagination Room serta sisa versi. Temuan ini adalah celah cakupan; hasil scan data sekarang tidak menunjukkan orphan tua yang memenuhi kriteria tersebut.

**P2 — Konten yang valid dapat melampaui satu dokumen Firestore.**

Reproduksi lokal: 80 section teks × 2.000 karakter ASCII, ditambah 100 ucapan × 3.000 karakter UTF-8 tiga byte. Request section, compiler, dan schema ucapan menerima semuanya. Teksnya saja berukuran **1.060.000 byte**, sudah melewati batas dokumen **1.048.576 byte**, sebelum field lainnya dihitung. Seluruh wishes dan ExperienceDNA kemudian dimasukkan ke satu dokumen Receiver. Data demikian dapat lolos konfigurasi tetapi gagal diterbitkan. Tidak ada payload besar yang ditulis ke backend selama reproduksi.

Lokasi: [batas input](C:/Portofolio/project/kenangin/lib/studio/contracts.ts:41), [batas ucapan](C:/Portofolio/project/kenangin/lib/data/contracts/receiver.ts:65), [pembangunan snapshot](C:/Portofolio/project/kenangin/lib/receiver/service.ts:365), [penulisan satu dokumen](C:/Portofolio/project/kenangin/lib/data/firestore/firestore-receiver-repository.ts:75). Batas layanan: [Firestore quotas](https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields).

Perbaikan terdekat: validasi budget byte dokumen sebelum penerbitan dengan pesan yang dapat ditindaklanjuti. Jika seluruh kombinasi batas produk tetap harus didukung, pecah wishes/payload besar menjadi bagian snapshot immutable dengan revision yang sama, sebagaimana beatmap sudah dipisahkan ke aset B2.

**Gerbang Patch 11 — Verifikasi rilis dan pemberitahuan AI belum lengkap.**

- Tes transaksi memakai adapter serial dalam proses; kelulusannya tidak membuktikan contention Firestore nyata. Tidak ditemukan suite emulator Security Rules atau runner E2E dalam script pengujian aplikasi yang aktif.
- [Handoff 8 Oktober](C:/Portofolio/project/kenangin/docs/production-handoff.md:43) mencatat E2E Firebase/B2 nyata untuk alur lama. [QA editor 10 Oktober](C:/Portofolio/project/kenangin/docs/studio-authoring.md:93) memakai fixture/adapter. Alur terbaru masih memerlukan satu E2E layanan nyata dari contributor sampai penerbitan ulang dan Receiver.
- Android Chrome dan Safari/iPhone fisik, benchmark preprocessing, jaringan lambat, Room besar, memory profiling, Lighthouse/Core Web Vitals belum mempunyai bukti selesai yang ditemukan. Audit ini tidak menjalankan ulang UI atau perangkat fisik.
- Teks privasi Collector menjelaskan kurasi owner dan akses melalui tautan, tetapi belum menyebut pemrosesan proxy oleh Gemini. Roadmap sendiri menetapkan keputusan disclosure/consent AI sebelum public launch. [Teks Collector](C:/Portofolio/project/kenangin/components/collector/collector-form.tsx:285). Ini temuan kesesuaian produk, bukan penilaian hukum.
- Working tree masih memiliki banyak perubahan yang belum di-commit. Deployment, kesamaan rules terpasang dengan `firestore.rules`, least-privilege key, domain, monitoring, dan jadwal retensi belum diverifikasi. Pemeriksaan ini tidak melakukan push/deploy.

## Perbedaan lain yang perlu didokumentasikan

- `baking` masih ada dalam vocabulary lifecycle/UI, tetapi jalur publikasi sekarang menulis `ready` secara atomik dari draf `configuring`; tidak ditemukan penulisan status `baking` di jalur aktif. Perlindungan publikasi memakai transaksi dan versi Studio, bukan lock status tersebut. Sesuaikan diagram lifecycle dengan mekanisme nyata; tidak perlu menambahkan status sementara hanya demi diagram.
- Cache persisten aktif untuk **foto dan beatmap**. Video/musik memakai elemen media browser; tema memakai aset publik. Helper `navigator.storage.persist()` tersedia tetapi belum dipanggil. Ini lebih sempit daripada daftar cache Patch 10, dan sebagian memang keputusan yang dicatat dalam handoff. Budget maksimum 500 MiB/15%, expiry, dan LRU sudah ada.
- Catalog Aura/Transition masih valid, tetapi section authoring v2 memakai `atmosphere.motion` dan CSS glow umum. Ambient memory media pool serta choreography berbasis direction lama tidak boleh ditandai selesai hanya karena definisi catalog masih ada. [Compiler](C:/Portofolio/project/kenangin/lib/studio/authoring.ts:85), [renderer](C:/Portofolio/project/kenangin/components/receiver/receiver-experience.tsx:248), [CSS authoring](C:/Portofolio/project/kenangin/app/production.css:547).
- `contributionBytes` menjaga kuota contributor, bukan total storage Room yang direkonsiliasi: unggahan owner, musik, versi B2, dan file sebelum commit tidak semuanya tercakup. Jangan memakainya sebagai angka pemakaian bucket aktual.
- Halaman Panduan masih menyebut batas “pembuatan gaya cerita 20 kali/hari”, sementara authoring v2 memakai kompilasi deterministik sebelum jalur rate limit Director lama. Ini sisa copy yang perlu diselaraskan. [Panduan](C:/Portofolio/project/kenangin/app/guide/page.tsx:26).

## Urutan pekerjaan yang direkomendasikan

1. Tutup binding ukuran upload dan cleanup lintas namespace; keduanya menyangkut integritas batas storage sebelum akses publik diperluas.
2. Tambahkan batas byte snapshot dan uji Room pada batas kapasitas yang dijanjikan.
3. Revisi masterplan mengikuti keputusan musik/authoring terbaru, nyatakan scope Aura/ambient yang masih diperlukan, dan ubah next step menjadi penyelesaian Patch 10–11.
4. Jalankan gate rilis pada Node 22: tes, lint/typecheck/build, E2E authoring terbaru dengan akun/media QA, lalu Android/iPhone fisik dan pengukuran performa. Verifikasi deployment/rules/monitoring setelah artifact rilis siap.

Tidak disarankan menghidupkan kembali katalog lagu atau tiga direction AI untuk mengejar checklist lama. Mekanisme produk aktif sudah berubah atas keputusan pengguna; yang belum selesai terutama perlindungan batas, lifecycle, dan bukti kesiapan rilis.

## Pemeriksaan lanjutan: Aura pada pratinjau authoring v2

Pengguna melaporkan tidak ada efek visual bergerak di pratinjau. Pemeriksaan kode, eksekusi compiler aktual, dan pemeriksaan computed style browser menemukan dua penghambat langsung. Katalog berisi 9 entri (8 efek dan `neutral`), tetapi keberadaan katalog tidak berarti efek tersebut aktif di pratinjau.

1. **Pemilihan selalu netral.** [authoring.ts:85](C:/Portofolio/project/kenangin/lib/studio/authoring.ts:85) mengambil `theme.compatibleAura.slice(0, 1)`. Kelima tema menempatkan `neutral` pertama, misalnya [themes.ts:31](C:/Portofolio/project/kenangin/config/themes.ts:31). Preset Tenang/Berwarna/Energik mengubah intensitas dan respons musik, tetapi tidak mengubah pemilihan Aura ini.
2. **Renderer authoring v2 menonaktifkan animasi katalog.** [production.css:550](C:/Portofolio/project/kenangin/app/production.css:550) memberi `animation: none !important; scale: 1 !important` pada kartu untuk seluruh pilihan gerakan (`watermill`, `soft`, `none`). Baris 551 mengganti overlay katalog dengan gradien umum dan `animation: none`. Karena itu, mengganti ID Aura saja belum cukup menghidupkan efek. CSS lama untuk drift, breath, tilt, sinar, dan partikel masih tersedia di [globals.css:13392](C:/Portofolio/project/kenangin/app/globals.css:13392).
3. **Yang tersisa adalah aksen cahaya dari musik.** [receiver-experience.tsx:197](C:/Portofolio/project/kenangin/components/receiver/receiver-experience.tsx:197) membutuhkan gerakan dan musik aktif; sinyal juga memerlukan audio berjalan serta beatmap. Untuk authoring v2, tanpa musik section yang aktif, sinyal depan bernilai nol (baris 210); soundtrack hanya menggerakkan sinyal latar. [production.css:552](C:/Portofolio/project/kenangin/app/production.css:552) mengubah opacity/scale gradien dengan sinyal tersebut. Tidak ada animasi dekoratif dasar yang tetap berjalan tanpa musik pada jalur ini.

| Verifikasi | Hasil |
|---|---|
| Compiler aktual, 5 tema × 3 preset × 3 pilihan gerakan, dengan section foto sintetis | 45/45 menghasilkan `auraIds: ["neutral"]` |
| Browser, CSS asli dengan urutan `globals.css` lalu `production.css`, 9 Aura × 3 pilihan gerakan | 27/27: animasi kartu dan overlay `none`, scale kartu `1` |
| Browser dengan `data-motion="on"` dan `--beat: 1` sintetis | Seluruh overlay memakai satu gradien umum; opacity 0,3, sehingga aksen cahaya tetap berbeda dari animasi katalog |
| Kontrol pembanding memakai transisi lama `soft-reveal` pada halaman uji yang sama | Animasi drift, breath, tilt, partikel, dan sinar muncul dalam computed style; penonaktifan tidak bersifat global pada browser uji |

Pengujian browser memakai halaman diagnostik sementara dengan CSS proyek dan DOM sintetis, bukan sesi Room pengguna. Pemeriksaan ini tidak menguji playback MP3/beatmap Room pengguna atau perangkat fisik. Server diagnostik dihentikan setelah pemeriksaan. Tidak ada perubahan kode fitur, data Room, maupun publikasi.

Rekomendasi: hubungkan preset dengan Aura kompatibel yang benar-benar dipilih, lalu pisahkan lapisan animasi media/overlay dari lapisan navigasi watermill dan caption. Gerak dasar perlu punya perilaku jelas tanpa musik; beat/energi menambahkan aksen di atasnya. Pertahankan teks stabil, prioritas audio, dan reduced motion. Uji penerimaan perlu memeriksa animasi yang benar-benar diterapkan browser; tes validitas manifest saja tidak menangkap kedua penghambat ini.
