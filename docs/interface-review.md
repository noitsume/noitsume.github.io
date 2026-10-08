# Pemeriksaan antarmuka dan gerakan

Mode **full**, cakupan alur owner, contributor, dan receiver yang diubah dalam
pekerjaan ini. Stack: Next.js 16.2.12, React 19, TypeScript, CSS bersama dengan
token tema yang sudah ada. Audit bukan sertifikasi aksesibilitas seluruh situs.
Halaman autentikasi dipakai saat QA; desainnya tidak ditulis ulang.

## Cakupan yang diperiksa

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Judul dashboard, Room, Studio, hasil terbit; body panduan dan ucapan 3.000 karakter; `app/production.css:3` | Kontras teks sekunder, lebar baca, wrapping, dan ukuran kontrol diperbaiki; terbaca pada tampilan yang diuji. |
| Surfaces | Dashboard, stepper, panel Room, action bar, dialog native, album, lima tema; desktop dan viewport ponsel | Permukaan memakai token bersama, radius berjenjang, dan shadow untuk elemen mengambang. |
| Animations | Dialog 220 ms, kontrol 160 ms, receiver scroll/beat/energy, toggle gerakan, aturan reduced motion | Navigasi tidak bergantung pada animasi. Pemeriksaan kecepatan 10% dan OS reduced motion belum dijalankan. |
| Icons | Ikon shared shell/dialog, label tombol audio/gerakan, marker pembuka, status tersimpan | Ikon tetap memakai sistem yang ada; tindakan penting memiliki nama aksesibel atau teks. Marker pembuka yang terpengaruh aturan `span` sudah diperbaiki. |
| Performance | Mount media sekitar bagian aktif, objek URL foto, bounded beat map, cache recovery, build produksi | Tidak memuat seluruh video sekaligus; cache gagal tidak menghalangi jaringan. Tidak ada klaim FPS, Web Vitals, atau kecepatan perangkat fisik. |

## Temuan yang sudah diperbaiki

Tabel ini merangkum perubahan sistemik, bukan daftar masalah yang masih terbuka.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `lib/domain/journey.ts:3`, `components/ui/page-heading.tsx:4`, `components/rooms/room-progress.tsx:15`, `components/collector/room-workspace-live.tsx:458`, `components/studio/settings-studio.tsx:79`, halaman `app/rooms/[id]/{page,studio/page,bake/page,finish/page}.tsx` | Aksi tersebar; langkah kembali/lanjut dan prasyarat sulit ditemukan. | Panduan dari status tersimpan, tahap bersama, action bar tetap terlihat, label kembali/lanjut spesifik. | Staging: pengguna dapat mengenali tindakan utama berikutnya. |
| HIGH | `components/ui/dialog.tsx:7`, `components/rooms/create-room-modal.tsx:8`, `components/shell/app-shell.tsx:9`, `components/shell/sidebar.tsx:15` | Modal dan menu ponsel belum memakai mekanisme fokus bersama. | Dialog native dengan backdrop, Escape, pemulihan fokus, dan blokir tutup saat menyimpan. Menu menutup sesudah navigasi. | Focus containment, kedalaman visual, dan navigasi keyboard. |
| MEDIUM | `app/layout.tsx:5`, `app/production.css:3`, `app/production.css:27`, `app/production.css:167` | Teks sekunder/kontrol terlalu kecil dan hierarki panel bertumpuk. | Kontras teks tema terang/gelap, line-height dan lebar baca, input 16 px, judul lebih terarah, metadata ringkas. | Typography dan text wrapping menjaga keterbacaan. |
| MEDIUM | `app/production.css:10`, `app/production.css:30`, `app/production.css:39`, `app/production.css:195` | Respons tekan dan ukuran sasaran kurang konsisten. | Kontrol utama minimum 44 px, tekan skala .96, transisi properti tertentu 160 ms; radius dialog/panel/kontrol berjenjang. | Minimum hit area, concentric radius, dan subtle deformation. |
| MEDIUM | `components/rooms/room-form.tsx:27`, `components/collector/collector-share-panel.tsx`, `components/collector/room-workspace-live.tsx:485` | Form tanggal dan teks pengumpulan kurang membantu pada status tertutup. | Pilihan tenggat cepat, validasi tanggal, state sibuk, serta salinan khusus setelah pengumpulan ditutup. | Umpan balik mengikuti keadaan sebenarnya. |
| HIGH | `components/collector/collector-form.tsx:42`, `app/c/[collectorId]/page.tsx`, `components/collector/submission-manager.tsx:24`, `components/collector/media-inventory.tsx:57` | Risiko kehilangan teks atau pengiriman ganda; ucapan panjang/metadata teknis membuat peninjauan berat. | Draf teks, payload retry stabil, batas file eksplisit, ucapan dapat diperluas, Terima/Lewati, analisis lanjutan dalam disclosure. | Recovery dan progressive disclosure mengurangi kerja ulang. |
| HIGH | `components/studio/settings-studio.tsx:141`, `components/studio/settings-studio.tsx:244`, `components/studio/settings-studio.tsx:776` | Pilihan yang belum disimpan mudah hilang; penyimpanan identik dapat menghapus gaya yang sudah dipilih. | Draf lokal tervalidasi terhadap versi server, save/discard dialog, dan penyimpanan hanya saat berubah. | Kontinuitas pekerjaan dan kontrol pengguna. |
| MEDIUM | `lib/studio/director.ts:354`, `components/studio/settings-studio.tsx:500` | Kegagalan AI mengurangi pilihan cerita. | Tiga gaya bawaan dengan tempo/beat berbeda, tetap menyertakan semua media dan petunjuk cerita. | Pemulihan menyediakan hasil yang dapat diterbitkan tanpa ketergantungan AI runtime. |
| HIGH | `components/studio/bake-progress-shell.tsx:8`, `components/studio/receiver-finish-card.tsx:9` | Penerbitan otomatis dan progres buatan menyulitkan pemeriksaan sebelum membagikan. | Ringkasan media/musik/gaya, tindakan terbit eksplisit, state proses sebenarnya, tautan tetap dan opsi ubah cerita. | Status harus mencerminkan pekerjaan server yang sebenarnya. |
| MEDIUM | `components/dashboard/dashboard-room-sections.tsx:149`, `app/dashboard/page.tsx`, `lib/receiver/analytics.ts:8`, `app/{guide,events,templates}/page.tsx` | Sulit menemukan Room; angka dan menu pendukung belum membantu pekerjaan utama. | Pencarian, tujuan kartu sesuai status, analytics aktual, panduan, agenda, dan koleksi tema. | Orientasi dan informasi yang dapat ditindaklanjuti. |
| HIGH | `components/receiver/receiver-experience.tsx:96`, `app/production.css:200`, `app/production.css:232`, `app/production.css:305` | Pembuka/audio dan navigasi kurang jelas; scroll akar dapat menggeser toolbar keluar layar, sementara gutter scrollbar meninggalkan strip kosong pada layar penerima. | Gesture pembuka, toolbar dan navigasi tetap, fokus bagian melalui posisi scroll, root overflow clip dan gutter khusus receiver. | Staging dan navigasi tetap dapat digunakan di bagian terakhir maupun konten panjang, dengan cerita memenuhi lebar layar. |
| HIGH | `components/receiver/receiver-experience.tsx:44`, `components/receiver/receiver-experience.tsx:59`, `lib/receiver/playback.ts:1`, `app/production.css:236` | Album, ucapan lengkap, dan musik pada video/akhir cerita memiliki edge case. | Kontrol album, dialog semua ucapan, ducking dari playback aktual, null-safe final section, retry aset individual. | Tidak memotong pesan dan tidak mengorbankan suara utama atau alur akhir. |
| MEDIUM | `components/receiver/receiver-experience.tsx:21`, `lib/browser-cache/cache.ts`, `lib/browser-cache/db.ts:33`, `app/production.css:161`, `app/production.css:246` | Penyimpanan terblokir bisa menahan pemuatan; dekorasi bergerak tidak mengikuti kebutuhan pengguna. | Timeout IndexedDB, fallback jaringan, kunci revisi, culling, beat/energy terbatas, toggle gerakan dan reduced motion. | Resource restraint dan motion restraint. |
| MEDIUM | `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`, `components/collector/room-workspace-live.tsx`, `app/production.css:100` | Kegagalan/muat halaman atau koneksi pembaruan tidak memiliki jalur pemulihan konsisten. | Loading jujur, tombol coba lagi/kembali, polling server ketika listener gagal, data terakhir tetap terlihat. | Pengguna dapat melanjutkan setelah kegagalan sementara. |

## Catatan 12 prinsip animasi

Temuan berikut sudah ditutup pada implementasi:

```text
app/production.css:10 - [timing-consistent] Kontrol bersama memakai transisi 160 ms pada properti yang relevan.
app/production.css:11 - [physics-subtle-deformation] Umpan balik tekan menggunakan skala .96.
app/production.css:32 - [easing-entrance-ease-out] Dialog masuk 220 ms dengan kurva yang melambat; penutupan tidak menahan pengguna.
app/production.css:31 - [staging-dim-background] Backdrop menempatkan fokus visual pada dialog di top layer browser.
app/production.css:161 - [motion-restraint] Preferensi sistem meniadakan gerakan; penerima juga menyediakan kontrol langsung.
app/production.css:246 - [staging-one-focal-point] Aura merespons beat secara halus di sekitar konten aktif.
```

| Rule | Count masih terbuka pada cakupan yang diperiksa | Severity |
| --- | --- | --- |
| Timing dan easing kontrol | 0 | — |
| Feedback tekan | 0 | — |
| Staging dialog dan cerita | 0 | — |

## Dipertimbangkan dan tidak dipakai

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Alur Room/Studio | Menambah kartu petunjuk dan efek masuk pada setiap panel | Menambah sasaran yang saling bersaing; action bar serta panduan dari status menyelesaikan kebingungan navigasi secara langsung. |
| Receiver | Memaksa semua video/musik masuk Cache Storage sebagai Blob | Berisiko memperbesar memori dan waktu awal di ponsel. Streaming native dipertahankan; foto dan beat map memakai cache eksplisit. |
| Receiver | Scroll terkunci dan perpindahan otomatis antarbab | Ucapan panjang membutuhkan waktu baca bebas; kontrol manual dan scroll tetap tersedia. |

## Verifikasi dan verdict

Perintah dan hasil lengkap ada pada [production-handoff.md](production-handoff.md).
Interaksi nyata mencakup registrasi, membuat Room, kiriman tiga media dan ucapan,
moderasi, Studio, fallback AI, penerbitan, penerima sampai ucapan akhir, serta
penerbitan ulang versi 2. Build produksi lokal diuji dengan backend yang sebenarnya.

Tidak ditemukan temuan antarmuka yang masih perlu diperbaiki pada pemeriksaan ini.
**Approve dalam cakupan yang diuji.** Belum diverifikasi: gerakan pada kecepatan
10%, reduced motion sistem melalui perangkat, perangkat Safari/Android fisik,
screen reader, throttling jaringan, dan metrik performa lapangan. Verdict ini
menyatakan hasil pemeriksaan, bukan jaminan bahwa seluruh variasi browser bebas bug.
