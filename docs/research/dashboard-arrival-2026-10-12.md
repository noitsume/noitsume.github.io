# Riset dashboard dan kedatangan ke meja

12 Oktober 2026 · Status: rekomendasi desain dan teknis, belum implementasi produk.

Rekomendasi: **cahaya menuntun ke meja**. Mulai dari dekat bibir meja, bergerak sekali mengikuti sorot lampu, lalu tenang pada permukaan tempat dashboard berada. Pertahankan charcoal–amber, identitas meja, struktur dashboard, dan UI login yang disukai. Kualitas yang dicari adalah kontinuitas ruang, material, dan tempo yang disengaja.

Mode skill: `evolve-ui-to-god-tier` digunakan untuk scan/research dengan tujuan evolve. `creative-stack-orchestrator` menentukan pembagian kerja; `web-optimization` memisahkan dugaan biaya dari hasil pengukuran. Tidak ada perubahan pada source aplikasi, dependensi, akun, atau data Room dari riset ini.

## 1. Temuan yang menentukan arah

| Bukti workspace | Implikasi |
| --- | --- |
| [auth-to-desk-transition.tsx:7](C:/Portofolio/project/kenangin/components/auth/auth-to-desk-transition.tsx:7): persiapan 4.400 ms + kamera 5.350 ms = **9.750 ms** | Waktu ini dijadwalkan setelah sesi berhasil; bukan estimasi lama pemuatan dashboard. |
| [auth-form.tsx:56](C:/Portofolio/project/kenangin/components/auth/auth-form.tsx:56) menunggu timer, kemudian `window.location.replace(destination)`; onboarding memakai pola sama | Permintaan dokumen tujuan baru dimulai sesudah jeda tersebut. Mempercepat renderer saja tidak menghapus hambatan UX ini. |
| [globals.css:7687](C:/Portofolio/project/kenangin/app/globals.css:7687): meja diskalakan 0,48 → 2,55; [baris 7702](C:/Portofolio/project/kenangin/app/globals.css:7702): langkah berupa translate/rotate linear antar titik | Gerak mendekat tidak memiliki parallax kamera/geometri yang konsisten. Goyangan langkah memperkuat kesan animasi buatan. Ini penilaian desain berdasarkan mekanisme kode, bukan hasil studi pengguna. |
| [auth-to-desk-transition.tsx:109](C:/Portofolio/project/kenangin/components/auth/auth-to-desk-transition.tsx:109): meja jauh dan `DeskSurface` tampak atas adalah lapisan terpisah | Ada pergantian representasi meja tepat saat pengguna diharapkan percaya bahwa ia sedang mendekat ke objek yang sama. |
| [globals.css:8721](C:/Portofolio/project/kenangin/app/globals.css:8721) menahan kamera sebelum fase aktif; auth ambient dipause dan kemudian disembunyikan | Sudah ada optimasi. Tidak tepat menyebut seluruh implementasi sebagai brute force tanpa membedakan bagian yang telah diperbaiki. |
| [AppShell:16](C:/Portofolio/project/kenangin/components/shell/app-shell.tsx:16) memasang `DeskBackground` pada shell bersama | Mengganti komponen ini langsung menjadi WebGL akan memengaruhi Room/Studio juga. Scene baru harus dipilih khusus dashboard. |

Dashboard aktif diperiksa langsung di Chrome pengguna, dark theme, viewport 1920 × 935, header sedang dilipat. Warna charcoal dan sapuan amber sudah menyatu. Kesempatan perbaikannya: sumber cahaya kurang terbaca sebagai lampu meja, panel/cover Room berulang dengan bobot visual hampir sama, dan hero mengambil perhatian yang bisa diarahkan ke pekerjaan Room.

Kode [DashboardRoomCard:72](C:/Portofolio/project/kenangin/components/dashboard/dashboard-room-sections.tsx:72) saat ini memang membuat cover dekoratif yang sama, tanpa media atau identitas tema per Room. Jangan menganggap variasi cover sudah berasal dari foto pengguna.

Riwayat [production-plan](C:/Portofolio/project/kenangin/docs/production-plan.md:24) menetapkan meja kenangan pribadi, warm paper, coral untuk aksi, serta metadata ringkas. [Patch tuning](C:/Portofolio/project/kenangin/patch_note/PATCH_1_TUNING_NOTES.md:5) juga menjaga warna dan menata shell di bawah sorot lampu. Rekomendasi ini meneruskan keputusan tersebut.

## 2. Arah artistik dan storyboard

**Rasa:** kembali ke ruang pribadi yang tenang, siap melanjutkan kenangan. **Komposisi:** cahaya kanan atas menangkap sedikit bibir meja; permukaan kemudian memenuhi frame. **Tipografi:** pertahankan keluarga font yang ada; hierarki dibangun dari ukuran, lebar baris, dan kontras, bukan font baru. **Gerak:** satu perjalanan, perlambatan halus, UI hadir setelah fokus ruang stabil. Tidak membutuhkan suara otomatis.

Referensi yang dibaca: [Lusion — The Turn of the Screw](https://v2.lusion.co/work/the-turn-of-the-screw-trailer/). Timnya memakai lintasan kamera yang sudah ditentukan untuk mengetahui bagian geometri yang benar-benar terlihat. Adaptasi di sini: cukup bangun meja dan lampu yang dilalui kamera; sebuah ruangan lengkap tidak diperlukan. Pipeline point cloud/Houdini mereka tidak perlu disalin.

[Igloo Inc.](https://www.igloo.inc/) dibuka dan tampilan awalnya diperiksa langsung: satu objek utama terbaca lewat material, bayangan, dan cahaya, sementara teks berada di tepi komposisi. Pelajaran untuk Kenangin adalah disiplin fokus tersebut. Identitas es, partikel, dan keseluruhan pengalaman scroll-nya tidak menjadi desain dashboard. Tidak dilakukan audit runtime menyeluruh pada referensi ini.

Angka di bawah adalah **titik awal prototipe**, bukan durasi yang sudah divalidasi pengguna. Waktu jaringan tidak dimasukkan ke durasi artistik.

| Fase | Waktu usulan | Yang terlihat dan tujuan |
| --- | --- | --- |
| Sesi berhasil | ≤180 ms sebelum navigasi | UI login keluar pendek menuju warna material yang sama. Dokumen dashboard segera diminta. Tidak ada progress persentase yang tidak mewakili pekerjaan nyata. |
| Cahaya mengundang | 0–200 ms setelah scene siap | Frame dekat bibir meja; lampu kanan atas sudah memberi petunjuk arah. Tidak mulai dari ruangan jauh. |
| Mendekat | 200–1.050 ms | Kamera bergeser pendek mendekati permukaan, sekaligus mengubah sudut pandang secara lembut. Geometri meja dan lampu tetap objek yang sama. |
| Menetap | 1.050–1.400 ms | Kecepatan menurun sampai nol; lampu dan bayangan tetap tertambat pada meja. Tidak ada ayunan langkah, overshoot kamera, atau flicker berulang. |
| Dashboard hadir | 1.200–1.700 ms, bertumpang tindih | Kelompok navigasi, area Room, lalu rail muncul dengan pergeseran kecil. Fokus keyboard dan interaksi langsung menyelesaikan animasi ke posisi akhir. |

Mulai pengujian dengan perspektif dekat yang masih memperlihatkan ketebalan meja, berakhir mendekati tampak atas. FOV dipertahankan; kamera yang berpindah, bukan ukuran seluruh layar yang dipompa. Sudut, jarak, dan panjang gerak harus ditentukan lewat blocking desktop/mobile, bukan dianggap selesai dari angka matematika saja.

**Alternatif yang benar-benar berbeda:** tampak atas dari awal, kemudian cahaya menyapu permukaan selama sekitar 500–700 ms dan UI tampil. Mekanismenya komposisi 2D dengan material/light mask, tanpa perjalanan kamera. Lebih mudah dibuat ringan dan lebih tahan terhadap pergantian dokumen, tetapi rasa mendekati meja lebih lemah. Gunakan sebagai fallback perangkat lemah; untuk reduced motion gunakan keadaan akhir atau fade ≤180 ms.

Pilihan utama tetap perjalanan kamera dekat karena mempertahankan metafora pengguna. Jika prototipe belum bisa mempertahankan kontinuitas warna/material atau menambah waktu tunggu yang terasa, arah tampak atas menjadi keputusan yang lebih baik. Jangan menambal kegagalan itu dengan blur layar atau menambah durasi.

## 3. Lampu belajar: bentuk dan mekanisme

Warna yang dikunci dari [globals.css:5586](C:/Portofolio/project/kenangin/app/globals.css:5586) dan [baris 8042](C:/Portofolio/project/kenangin/app/globals.css:8042):

- Charcoal dasar `rgb(18 17 15)`, variasi lembut `rgb(29 25 20)`, gelap `rgb(10 10 9)`.
- Lampu `rgb(255 199 125)`, inti `rgb(255 226 176)`.
- Light theme meneruskan permukaan hangat dengan matahari dari kiri bawah; tidak diberi lampu malam yang menyala.

Bangun tiga komponen cahaya yang saling mendukung:

1. **Jejak cahaya pada kayu.** Satu SpotLight dengan penumbra lebar memberi pusat terang yang turun lembut ke pinggir. Mulai eksperimen penumbra sekitar 0,75–1; itu pilihan artistik, bukan angka fisika yang wajib. Roughness tinggi menahan pantulan plastik. [Dokumentasi SpotLight](https://threejs.org/docs/pages/SpotLight.html) menjelaskan penumbra dan atenuasi cahaya.
2. **Berkas tipis di udara.** SpotLight menerangi material; ia sendiri bukan objek transparan berbentuk berkas. Tambahkan mesh/shader kecil dengan alpha yang jatuh halus pada sisi dan sepanjang berkas. Ini pendekatan artistik terhadap hamburan cahaya, bukan simulasi volume fisik. Hindari segitiga solid dan pinggir cone yang terlihat sebagai geometri.
3. **Penambat sumber.** Sedikit siluet kepala lampu, cahaya pada bibir meja, dan contact shadow membuat arah sinar masuk akal. Mulai dengan shadow/baked mask statis; uji satu shadow map hanya jika pengambilan gambar memerlukannya.

Feather dibuat pada mask/shader, sehingga kelembutan tidak harus berasal dari beberapa blur CSS yang melebihi viewport. Berkas lebih lemah daripada jejak cahaya pada kayu; ruangan tidak terlihat berasap. Pada pose akhir, footprint cahaya yang menjaga kesan lampu, bukan cone besar di atas teks.

UI tetap DOM di depan scene. Cahaya Three.js tidak otomatis menyinari kartu HTML. Gunakan satu posisi lampu yang diproyeksikan ke koordinat layar untuk orientasi highlight CSS yang sangat tipis pada tepi panel. Teks, tombol, fokus, dan kontras tidak masuk postprocessing. Sesuaikan color space dan tone mapping terhadap screenshot palette lama; nilai RGB yang sama belum menjamin hasil visual sama setelah pencahayaan.

## 4. Pembagian tools dan kontrak runtime

| Komponen | Pekerjaan yang dipilih | Status nyata |
| --- | --- | --- |
| GSAP | Satu timeline artistik untuk pose kamera, target pandang, intensitas reveal, dan kelompok UI | Sudah ada, package range `^3.15.0`. Tidak perlu memasang motion library kedua. |
| R3F + Three.js | Satu canvas dashboard: meja, lampu, perspektif, material, dan berkas lembut | Sudah ada: R3F `^9.8.1`, Three `^0.186.1`. Baru diterapkan ke area ini pada tahap implementasi. |
| CSS/DOM | Semua navigasi, Room, search, status, rail, dialog, fallback material, focus | Pertahankan perilaku dan data yang ada. |
| Chrome DevTools MCP | Screenshot state, computed styles, trace, network, pemeriksaan error; bandingkan build produksi | Tersedia dan dipakai pada riset. MCP adalah alat pemeriksaan, bukan dependensi browser produksi. |
| Context7 + sumber resmi | Memeriksa API GSAP/R3F/Three yang akan digunakan | Dipakai. Tidak mengasumsikan contoh WebGPU cocok dengan renderer WebGL yang terpasang. |

**Pola yang sudah bisa digunakan ulang:** [AuraEnvironment:123](C:/Portofolio/project/kenangin/components/receiver/aura-environment.tsx:123) menggerakkan pose melalui GSAP lalu memanggil `invalidate`. Komponen yang sama sudah memiliki penanganan context loss, batas DPR, dan kait inspeksi Three untuk development. Pakai pola lifecycle-nya; jangan menarik sistem audio atau scene Aura ke dashboard.

Kontrak yang disarankan:

- GSAP adalah satu pemilik waktu artistik. State fase React hanya berubah di batas tahap; posisi kamera dan uniform dimutasi lewat ref, bukan `setState` setiap frame.
- R3F menggunakan `frameloop="demand"`. `onUpdate` meminta `invalidate()`, lalu renderer membaca pose terbaru. Tidak ada ticker kedua yang juga menulis pose. Setelah settle tidak ada permintaan frame berulang dari dekorasi meja.
- Jadwalkan frame awal sebelum mulai tween agar frame pertama tidak melompat. Ini mengikuti [R3F on-demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance); demand tetap membutuhkan invalidation saat properti dimutasi secara imperatif.
- Timeline dikumpulkan melalui [gsap.context](https://gsap.com/docs/v3/GSAP/gsap.context()/); revert pada unmount, hentikan listener/timer, dan bebaskan resource scene yang tidak dipakai. Jangan merekam tween baru di dalam `useFrame`.
- Lazy-load scene dari client boundary khusus dashboard. Panduan lokal [Next lazy loading](C:/Portofolio/project/kenangin/node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md) telah dibaca; `ssr:false` harus berada di Client Component. CSS fallback memberi material awal sebelum canvas tersedia.
- Siapkan shader sebelum kamera berjalan memakai `compileAsync` bila tersedia, setelah lampu/material terpasang. [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) menyediakan ini untuk mengurangi stall kompilasi. Metode ini juga ada di package lokal. Kesiapan compile bukan alasan untuk menahan UI tanpa batas.
- Scene ini kecil dan berkamera tetap: mulai dengan meja, bagian lampu yang terlihat, berkas, serta shadow plane. Belum membutuhkan physics, full room, bloom fullscreen, depth of field, raymarch volume, particle engine, atau ScrollSmoother.

**Jembatan login perlu didesain secara jujur.** `window.location.replace` mengganti dokumen; canvas/timeline tidak bertahan melintasinya. Pertahankan navigasi ini karena komentar kode mencatat perlindungan terhadap Router Cache pra-login. Jadikan perpindahan sebagai potongan yang warnanya cocok, lalu jalankan kamera di dashboard. Jangan mengklaim satu kamera hidup terus dari login.

Simpan petunjuk visual satu kali berisi versi, waktu, tema, dan path tujuan di sessionStorage setelah sesi berhasil. Konsumsi hanya untuk `/dashboard`, kedaluwarsa singkat, tanpa token atau username. Deep link Room tetap menuju Room; onboarding memicu satu kedatangan setelah selesai. Storage gagal, renderer gagal, tab lama aktif lagi, atau script gagal harus tetap memperlihatkan dashboard.

**Cegah dashboard terlihat lalu tiba-tiba tertutup intro.** Workspace sudah memiliki [ThemeScript](C:/Portofolio/project/kenangin/components/theme/theme-script.tsx:1) di head sebelum paint. Untuk implementasi, gunakan bootstrap arrival kecil dan terpisah, dengan pengecekan path, umur marker, dan reduced motion sebelum paint; jangan mengubah logika pemilihan warna login. CSS harus memiliki jalan keluar otomatis jika client scene tidak siap. Gate ini wajib dibuktikan di jaringan lambat dan hydration tertunda. Jika scene tidak siap dalam jendela awal yang pendek, tampilkan fallback dan batalkan replay; jangan memunculkan intro terlambat di atas dashboard yang sedang digunakan.

## 5. Polesan dashboard yang layak diprioritaskan

| Area sekarang | Polesan yang diusulkan | Batas yang dijaga |
| --- | --- | --- |
| Lampu berupa sapuan luas | Sorot terarah, pool pada kayu, tepian berkas lembut, sumber lampu sedikit terbaca | Charcoal–amber dan kontras isi tetap. |
| Hero dan empat statistik dominan | Padatkan tinggi hero secukupnya; perjelas jarak headline, penjelasan, dan baris statistik | Semua statistik tetap berasal dari data yang sama; headline/identitas tidak perlu diganti. |
| Cover Room dekoratif seragam | Variasi kecil berbasis tema/identitas Room yang tersedia, dengan crop dan penempatan status konsisten | Jangan memuat foto privat atau memberi kesan thumbnail sudah tersedia bila belum ada kontraknya. |
| Kartu, sidebar, dan rail memiliki bobot hampir sama | Area Room menjadi fokus; rail lebih tenang; tepi yang menghadap lampu menangkap highlight halus | Struktur kiri–utama–kanan, history, analytics, dan event dipertahankan. |
| Tombol buat berbentuk kartu sejajar Room | Perjelas ia adalah aksi; ukur apakah kartu bisa lebih ringkas sehingga Room pertama lebih cepat ditemukan | Tetap satu tindakan utama yang jelas, bukan menambah CTA besar di banyak tempat. |
| Interaksi permukaan | Hover/focus singkat sekitar 120–180 ms, naik 1–2 px bila sesuai; menu dan pin tetap mudah disentuh | Tidak ada tilt/parallax pada teks atau tombol; keyboard tidak tergantung hover. |

Tidak memakai metafora buku/sticky note secara literal untuk setiap fitur. Kedalaman cukup dari perbedaan material, bayangan kontak, tepi cahaya, dan ruang antar kelompok. Pada ponsel, lampu dirapatkan ke tepi dan berkas dipersempit agar area isi tetap terang-terbaca. Tata letak memakai alur responsif yang sudah ada; tidak memperkecil desktop sebagai satu gambar.

## 6. Bukti performa dan batas kepastian

Computed style pada dashboard pengguna menunjukkan lapisan diffusion sekitar 2286 × 1122 dengan blur 38 px, beam 1430 × 1220 dengan blur 32 px, spill 1590 × 1360 dengan blur 50 px. Semua lapisan meja yang diperiksa memiliki animation `none` saat idle. Ukuran ini kandidat pemeriksaan raster/compositing, bukan bukti bahwa GPU terus bekerja berat saat diam.

Audit heuristik `web-optimization/scripts/audit_web.py` pada `app` menemukan kandidat blur/backdrop-filter, termasuk aturan aktif tersebut. Temuan source dicocokkan dengan computed style karena stylesheet memiliki beberapa patch yang saling menimpa.

Percobaan login terisolasi berhenti sebelum autentikasi karena halaman melaporkan konfigurasi Firebase publik belum tersedia. Tidak memakai kredensial akun nyata. Sebagai pemeriksaan terbatas, markup dan timer transisi dari source direplay pada CSS halaman yang berjalan. Replay ini **tidak** menguji Firebase, mount React asli, pergantian dokumen, atau kesiapan dashboard.

| Replay development, 1365 × 900, DPR 1 | Prelude: p95 interval rAF | Kamera: p95 interval rAF | Catatan |
| --- | --- | --- | --- |
| Dengan trace; tab referensi masih terbuka | 76,4 ms | 90,2 ms | Lingkungan lebih bising; bukan baseline untuk perbandingan produksi. |
| Tanpa trace; tab referensi ditutup | 34,7 ms | 27,7 ms | Fase kamera: 515 sampel, maksimum 83,4 ms, 17 interval >33,4 ms. |

Kedua replay tidak mengamati Long Task. Ini tidak membuktikan bahwa compositor/GPU bebas hambatan. Interval rAF bukan waktu GPU atau FPS presentasi. Perbedaan antar-run terlalu besar untuk menyatakan penyebab tunggal atau rasio peningkatan yang dijanjikan. DevTools menghasilkan ringkasan trace, tetapi ekspor raw trace ditolak konfigurasi workspace connector; tidak ada file raw trace yang diklaim tersimpan. [Catatan pengukuran](C:/Portofolio/project/kenangin/docs/research/dashboard-arrival-evidence/measurement-notes.json) menyimpan output dan kondisi percobaan.

**Budgets prototipe, belum hasil:**

- Navigasi dimulai ≤200 ms setelah sesi berhasil; tidak ada penundaan dekoratif 9,75 detik.
- Koreografi sesudah scene siap sekitar 1,6–1,8 detik. Jaringan lambat menampilkan kondisi loading sebenarnya. Kesiapan asset tidak menambah ritual loading kedua.
- Mulai DPR canvas maksimum 1,5 pada desktop dan sekitar 1 pada mode ringan; UI DOM tetap tajam. Ini parameter awal, harus dibandingkan hasil visualnya.
- Mulai dengan <20 draw calls dan tanpa postprocessing fullscreen. `renderer.info` membuktikan jumlah, bukan tebakan dari jumlah komponen JSX.
- Target desktop uji: interval rAF p95 mendekati satu frame pada refresh rate yang dipilih, dengan jumlah interval >33,4 ms dilaporkan; target 60 Hz sekitar 16,7 ms. Jangan menyamakan angka ini dengan pengukuran GPU.
- Idle: penghitung render scene tidak terus naik setelah settle. Interaksi Room/search dan scroll tidak menyalakan loop dekoratif.

Validasi produksi perlu setidaknya tiga run sebanding pada viewport, tema, konten, cache, dan perangkat yang sama: cold load, warm load, kamera, idle, scroll, theme toggle, serta mount/unmount berulang. Periksa filmstrip/rekaman pada kecepatan normal, frame pacing, paint/raster/compositing, main-thread task, context/resource count, serta waktu dashboard benar-benar bisa dipakai. Viewport emulasi bukan bukti perangkat Android/iPhone fisik.

## 7. Urutan implementasi berikutnya

1. **Blocking satu adegan terisolasi.** Bandingkan kamera dekat dan tampak atas dengan palette yang sama. Buktikan ketebalan meja, sumber cahaya, final pose, serta versi mobile sebelum menambah detail material.
2. **Integrasi sesi → dokumen → scene.** Ubah hanya batas sesudah sukses pada auth/onboarding, marker satu kali, dan gate pra-paint. Uji login biasa, onboarding, deep link, error, reduced motion, storage ditolak, dan koneksi lambat. UI form/login dipertahankan.
3. **Lampu dan dashboard.** Satu scene desktop, CSS/static fallback, polesan hierarki Room dan rail. CSS baru diberi scope dashboard; aturan transisi lama diganti secara terarah, bukan ditumpuk dengan override tambahan.
4. **Profiling dan penyelesaian.** Gunakan DevTools untuk menemukan biaya nyata, lalu pertahankan hasil visual saat menurunkannya. Periksa light/dark, layar sempit, keyboard, menu/pin/search, dan perpindahan ke Studio tanpa canvas ganda.

Peta perubahan nantinya: `components/auth/auth-to-desk-transition.tsx`, success handler pada auth/onboarding, komponen arrival/desk-scene baru, `DeskBackground`/`AppShell` dengan opt-in dashboard, bootstrap arrival terpisah, dan style dashboard yang terlokalisasi. Backend, Aura, Receiver, serta layout visual login tidak masuk pekerjaan ini.

Risiko terbesar: renderer baru menambah download/compile dan membuat intro terlambat, atau hasil CSS→WebGL berganti warna sehingga ilusi ruang pecah. Solusinya harus dibuktikan pada prototipe: lazy load, precompile, warna akhir yang cocok, serta fallback yang sudah bisa dipakai. GSAP/R3F menyediakan kontrol yang lebih tepat; keduanya tidak otomatis membuat halaman lebih cepat atau desain lebih matang.
