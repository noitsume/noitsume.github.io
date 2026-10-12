# Aura & Receiver — dua lapisan musik, v2

Status 12 Oktober 2026: implementasi berjalan melalui **Room → Studio → Pratinjau & Suasana**. Kelanjutan ini tidak membuat halaman demo baru. Room akun **Aura · Rintik & Ritme** (`room_b46e26e23bd44b26914b6eca94000427`) berisi pesan hangat, album dengan musik tersendiri, dan video bersuara. Room masih draf; belum diterbitkan atau dideploy.

## Mencoba hasil

1. Buka Room tersebut, lalu **Studio → Pratinjau & Suasana**. Tekan **Buka kejutan** untuk memulai soundtrack, atau pilih section pada **Urutan ceritamu**, lalu nyalakan musik.
2. **Pelan-pelan, terasa kembali** memakai Rintik Resonansi dari soundtrack. **Ritme di antara momen** memakai Spektrum Ruang dari musik section, dengan latar tetap Rintik. **Suara video, Aura berbeda** memakai Arus Cahaya dari audio video.
3. Jeda musik menahan lapisan dari musik. Video mempunyai kontrol sendiri: jika masih bersuara, Aura depannya berjalan. Jeda video menahan lapisan video; soundtrack yang masih terdengar tetap menggerakkan latar.
4. Atur karakter depan melalui tombol **Suasana** tiap section. **Aura belakang · soundtrack Room** hanya ada pada pengaturan keseluruhan. Musik v1 dapat diperbarui lewat **Tingkatkan beatmap** di pustaka musik.
5. **Muat ulang pratinjau** menerapkan draf dan memperbarui URL media privat. Pratinjau yang dibiarkan lama bisa memerlukan pemuatan ulang karena URL berumur terbatas.

## Kontrak sumber dan waktu

| Lapisan | Sumber | Perilaku |
| --- | --- | --- |
| Belakang | Satu soundtrack Room | Jam diteruskan saat pindah section; gain mengikuti campuran suara |
| Depan | Video aktif bersuara, lalu musik section | Waktu masing-masing media; tidak meminjam beat soundtrack jika analisis video belum tersedia |
| Section tanpa audio sendiri | Tidak ada sumber depan | Latar dapat berjalan; tidak menciptakan beat depan buatan |
| Section memakai lagu yang sama dengan soundtrack | Satu elemen audio bersama | Tidak memutar dua salinan atau mengunduh beatmap yang sama dua kali |

Sampler berjalan tepat sebelum R3F menggambar, membaca `HTMLMediaElement.currentTime`. Binary search menemukan event terakhir, lalu umur efek dihitung langsung dari timestamp. Seek tidak mengantrekan beat yang terlewat. Puncak onset dimulai pada event, lalu meluruh; low-pass lama yang menggeser puncak sekitar 180 ms tidak dipakai pada renderer v2.

Pause, mute, seeking, buffering, gain nol, motion off, atau sumber tidak siap menahan frame terakhir lapisan terkait. Seek/resume mengambil keadaan pada waktu baru. Video dijeda mempertahankan komposisi apabila musik section tidak mengambil alih. Navigasi tetap berfungsi tanpa musik. Reduced motion dan tab tersembunyi menghentikan render kontinu; kegagalan WebGL memakai komposisi statis.

## Ekstraksi yang dipakai produk

Web Audio mendecode MP3 atau audio video AAC pada 22.050 Hz. Kanal ditransfer ke **Web Worker** untuk FFT 1.024 sampel, hop sekitar 10 ms, timestamp jendela terpusat, log spectral flux, ambang adaptif dan gerbang keheningan. Daya kanal digabung sesudah FFT agar stereo dengan fase berlawanan tidak saling menghapus. Ekstraksi dilakukan sekali di Studio, bukan setiap receiver dibuka.

Artefak `music-v2` berisi:

- Serangan bunyi: waktu, kekuatan, kontribusi low/mid/high. Ini bukan transkripsi not atau label kick/snare yang pasti.
- Kurva energi dan tiga pita pada 20 Hz, serta 16 pita spektrum logaritmis terkuantisasi.
- Estimasi tempo dan kualitas periodisitas; BPM berasal dari lag sebenarnya, bukan grid BPM yang dibulatkan sebagai clock.
- SHA-256 berkas, versi extractor, durasi dan timebase.

**Runtime upload akun memakai Worker TypeScript, bukan layanan Python/librosa.** Librosa/Python tetap jalur riset atau pembanding offline. Emosi lagu tidak diklasifikasikan otomatis. Preset hangat/sendu memakai energi lembut dan aksen mati; pilihan berirama memberi respons serangan lebih tegas. Rubato, vokal rapat dan tempo setengah/ganda masih memerlukan evaluasi beranotasi.

Video bersuara yang dipakai section dianalisis saat menyiapkan pratinjau. Studio meminta signed URL baru sebelum membaca audio agar URL awal halaman yang kedaluwarsa tidak menggagalkan ekstraksi. Codec yang tidak dapat didecode menampilkan pesan dan bisa dicoba ulang; video tetap dapat dimainkan tanpa Aura depan hasil ekstraksi.

## Data, preview dan publikasi

JSON lengkap disimpan di B2 dengan path berisi hash konten. Firestore hanya menyimpan ringkasan dan referensi kecil. Analisis ulang menghasilkan referensi baru tanpa menimpa artefak snapshot. API memeriksa pemilik Room, status penyuntingan, jenis media, durasi, hash, urutan event dan dimensi kurva.

Preview dan publikasi memakai compiler/descriptor aset yang sama. Video mengirim `audioBeatmapAssetId`; soundtrack/section mengirim `beatmapAssetId`. Receiver memuat analisis latar, section aktif dan section berikutnya. Analisis preview privat tidak masuk cache browser persisten.

Kompilasi baru memberi `rendererVersion: rintik-resonansi-v2`. Beatmap v1 tetap terbaca melalui adaptor energi/onset. Snapshot tanpa versi spatial memakai jalur legacy. `ruang-cahaya-v1` masih diterima renderer spatial saat ini; tampilan shader v1 yang persis sama belum dijamin dan harus diputuskan sebelum rilis migrasi publik. Data snapshot tersimpan tidak ditulis ulang.

## Keluarga visual dan kerja sama tools

| Keluarga | Pemetaan musik |
| --- | --- |
| Rintik Resonansi | Onset menumbuhkan riak pada titik deterministik; kekuatan menentukan ukuran, usia menentukan ekspansi; energi/pita memberi bokeh |
| Arus Cahaya | Pita dan partikel memakai waktu media; energi serta pita frekuensi mengubah bentuk/kecerahan |
| Spektrum Ruang | Enam belas kontur mengikuti pita spektrum; serangan memberi aksen tanpa mengguncang foto/teks |
| Ruang Cahaya / Resonansi | Pilihan bidang lembut atau garis geometris tetap tersedia |

Foreground mempunyai mask tepi dan pusat baca yang lebih tenang. **Aksen cahaya** adalah opt-in per suasana, memakai serangan kuat terpilih dengan jarak minimal 550 ms termasuk batas loop. Bukan flash seluruh layar dan tidak aktif hanya karena BPM tinggi.

Three.js/R3F menggambar dua lapisan dalam satu shader/canvas. GSAP mengatur buka/pindah adegan, bukan beat. DOM memegang foto, video, teks, fokus dan kontrol. Browser automation memeriksa UI, media dan shader bersama. MCP Three.js lokal pernah digunakan pada proof v1; pemeriksaan v2 ini memakai event inspeksi development dan CDP browser karena bridge MCP tidak tersedia/tersambung saat pemeriksaan. Tidak ada connector upstream yang dipasang.

## Bukti verifikasi

**61 tes proyek lulus** pada pemeriksaan akhir: FFT, stereo anti-fase, keheningan, onset pada timestamp, tempo 120/150 BPM, seek deterministik, gate playback, aksen lintas loop, kepemilikan media, penyimpanan di luar Firestore, serta immutability preview/publikasi. `npm run lint`, `npm run typecheck`, `npm test` dan `npm run build` lulus. Dependency lokal yang sempat tidak lengkap dipulihkan menggunakan `npm ci`; `npm run dev` kemudian mencapai Ready pada port 3000 dalam 3,1 detik dan Studio akun terbuka tanpa error browser.

Browser memakai Room akun sebenarnya: MP3 dari video referensi pengguna, MP3 lembut 76 BPM, dua gambar uji, dan video bergambar diam dengan audio referensi. Gambar diam memisahkan pengamatan Aura dari flash bawaan video asli. Unggah, ekstraksi MP3/audio video, simpan draf dan preview dijalankan melalui UI.

- Soundtrack dan musik section memiliki waktu serta uniform berbeda.
- Seek video ke 4 detik memberi waktu shader 4,012322 detik ketika video 4,012657 detik, tanpa antrean serangan lama.
- Jeda video menahan waktu depan 16,403835 detik dan counter frame 1.705 pada dua pembacaan. Setelah soundtrack dinyalakan, waktu belakang maju 7,668390 → 8,016689 sementara depan tetap.
- Reduced motion menahan uniform dan counter frame meskipun soundtrack berjalan.
- Pintasan section dari pembuka menuju section terpilih. Preview/navigasi diperiksa pada viewport sempit dan desktop; tidak ada overflow horizontal. Konten panjang mempunyai area baca yang bisa digulir.
- Satu canvas, satu draw call dan dua triangle diamati. Ini bukan bukti performa semua perangkat.

Probe 90 frame sebelum/sesudah menyatukan sampling dan render mencatat usia sampel p95 **51,835 → 0,678 ms**; frame-time sesudahnya p50 **20,8 ms**, p95 **27,9 ms**. Ini pengukuran sesi development lokal, bukan klaim 60 fps atau latensi suara-ke-mata. Latensi speaker, codec, GPU dan perangkat belum diukur ujung ke ujung.

Audio referensi 27,68 detik menghasilkan 182 serangan dan JSON sekitar 62 KB. Tempo 149,66 BPM adalah estimasi, bukan ground truth. [Laporan extractor](research/aura-reference-2026-10-12/runtime-v2-analysis.json) memisahkan pengukuran ekstraksi dan model kuantisasi frame. [Bukti v2](aura-receiver-v2-verification.json), [desktop](research/aura-reference-2026-10-12/room-v2-desktop.jpg) dan [mobile](research/aura-reference-2026-10-12/room-v2-mobile.jpg) mendokumentasikan pemeriksaan akun. [Bukti v1](aura-receiver-verification.json) tetap historis.

## Batas penyelesaian terhadap roadmap

| Paket | Sudah diimplementasikan | Masih terbuka |
| --- | --- | --- |
| AR-03 | Worker v2, spektrum/pita/onset, adaptor v1, musik section/audio video, artefak immutable | Dataset beranotasi, klasifikasi instrumen/emosi, memori pada batas 20 menit |
| AR-04/05 | Dua clock, preview akun, kontrol global/section, seek/pause, compiler publikasi bersama | Migrasi tampilan v1, codec Safari, perangkat fisik |
| AR-06 | Rintik, Arus, Spektrum serta dua pilihan bidang/garis | Kurasi komposisi dan pengujian dengan media pengguna yang beragam |
| AR-07/08 | Tes, build, inspeksi browser dan bukti Room | Trace panjang, Android/iPhone fisik, penerimaan visual dan deployment |

Lokasi utama: [extractor](../lib/audio/extract.ts), [schema/sampler](../lib/audio/features.ts), [gate transport](../lib/receiver/aura-playback.ts), [hook sumber](../components/receiver/use-aura-playback.ts), [shader](../components/receiver/aura-environment.tsx), [Studio](../components/studio/settings-studio.tsx), [penyimpanan](../lib/studio/service.ts).

