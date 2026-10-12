# Meja Kenangan — implementasi dan verifikasi

12 Oktober 2026. Perombakan dipasang langsung pada `/dashboard` dan transisi login yang sudah ada.

## Arah desain yang diterapkan

Workspace menjadi meja tulis personal: kayu walnut, alas kulit dengan jahitan, album linen hijau, tumpukan polaroid ilustratif, surat, pena, amplop dengan segel, dan lampu kuningan. Warna charcoal, krem, hijau gelap, dan emas hangat mempertahankan karakter Kenangin. Gambar polaroid merupakan dekorasi buatan kode, bukan foto pengguna.

Kamera terlebih dahulu menoleh ke kanan dengan posisi tetap, lalu mendekat dan naik menuju bidang kerja. Jarak kamera ke pusat meja terus berkurang selama fase mendekat; invariant ini diperiksa pada lima rasio layar. Panel dashboard muncul menjelang akhir gerakan. Refresh biasa tidak mengulang intro.

Tombol **Jelajahi meja** membuka kembali sudut meja dengan parallax kursor, pengaturan cahaya lampu, dan tombol kembali. Escape menutup tur; fokus keyboard kembali ke tombol pembuka. Dashboard mendapat judul editorial, statistik yang lebih jelas, dan kartu Room dengan detail polaroid. Pencarian, menu Room, dialog pembuatan Room, dan tautan workspace tetap menggunakan alur yang ada.

## Hubungan antarkomponen

| Bagian | Tanggung jawab |
| --- | --- |
| Three.js / React Three Fiber | Geometri, material, bayangan, kamera, serta render 3D. |
| GSAP | Satu timeline mengatur progres kamera dan munculnya panel DOM; kamera hanya ditulis oleh `useFrame`. |
| Drei | Geometri RoundedBox dan lingkungan pantulan beresolusi 128. Import dibatasi pada modul yang digunakan. |
| CanvasTexture | Tekstur kayu, album, surat, dan polaroid dibuat lokal tanpa unduhan aset. Texture dibuang saat unmount. |
| Shader berkas cahaya | Satu bidang transparan mengikuti lampu; uniform intensitas dan SpotLight membaca nilai GSAP yang sama. |
| Bootstrap kedatangan | Penanda login satu kali, TTL, batas persiapan 3,2 detik, dan pelepasan paksa maksimal 6 detik. Interaksi pengguna dapat melewatinya. |
| MCP Three.js lokal | Inspeksi scene, renderer, material, dan intensitas shader; sambungan sementara dengan mutasi dinonaktifkan. Tidak menjadi ketergantungan aplikasi. |
| Browser / Playwright melalui CUA | Memeriksa interaksi, screenshot, ukuran layar, reduced motion, dan kegagalan WebGL pada dashboard sebenarnya. |

Renderer menggunakan `frameloop="demand"`. GSAP memanggil `invalidate()` selama perubahan, sehingga scene berhenti merender setelah gerak selesai. DPR dibatasi 1–1,5. Persiapan shader memakai `compileAsync()` sebelum kamera bergerak. Tidak diperlukan render pass bloom layar penuh untuk berkas lampu ini.

Perbaikan khusus development: cleanup percobaan React Strict Mode tidak lagi menghabiskan penanda login saat shader masih dipersiapkan. Preload scene dimulai saat submit login, sehingga unduhan dapat berlangsung bersamaan dengan permintaan autentikasi.

## Bukti pemeriksaan

- Build produksi berhasil; lint tanpa warning dan typecheck lulus.
- Delapan tes terarah kamera/kedatangan lulus: pemakaian penanda sekali, TTL/data tidak valid, deep link, reduced motion, tab tersembunyi, batas waktu, pembatalan lewat interaksi, serta kontinuitas lintasan kamera.
- Browser: kedatangan melewati `pending → running → idle`; tombol lewati bekerja; refresh tidak mengulang intro.
- Browser: pencarian Room, menu Room, dan dialog Buat Room Baru diperiksa tanpa membuat atau menghapus data.
- Browser: tur, lampu, siklus Tab, Escape, dan pemulihan fokus bekerja.
- Mode terang/gelap dan viewport seluler diperiksa. Pemeriksaan akhir seluler: `innerWidth=390`, lebar dokumen 375, tanpa overflow horizontal.
- Reduced motion menghasilkan nol canvas dan nol elemen inert. Mengaktifkannya saat tur juga memulihkan dashboard.
- Kehilangan konteks WebGL sengaja disimulasikan: renderer beralih ke statis, canvas dibuang, dan nol elemen inert tertinggal. Reload memulihkan scene WebGL. Tidak ada error console setelah reload akhir.
- MCP lokal berhasil membaca scene dan memastikan intensitas shader menjadi 0,15 saat lampu diredupkan; koneksi inspeksi kemudian diputus.

Dalam satu sampel browser development dengan Intel UHD, persiapan shader berlangsung sekitar **222 ms**, animasi kedatangan **2,47 detik**, dan interval requestAnimationFrame terpanjang **27,8 ms** dari 326 sampel. Data mentah: [arrival-timing.json](arrival-timing.json). Ini merupakan interval callback browser, bukan pengukuran waktu GPU atau jaminan performa di semua perangkat. Penghitung frame renderer tidak bertambah saat scene diam pada pemeriksaan terpisah.

Alur kedatangan browser diuji dengan penanda yang sama seperti hasil login pada sesi akun yang sudah aktif. Login Google atau pengisian kredensial baru tidak diulang. Script QA CLI yang sudah ada diperbarui, tetapi verifikasi UI sesi ini dijalankan melalui browser terkelola CUA. Waktu unduh pertama masih bergantung perangkat/jaringan; jika melewati batas persiapan, workspace langsung dibuka tanpa intro.

## Hasil visual

- [Tur meja](tour-final.png)
- [Dashboard gelap](dashboard-final.png)
- [Dashboard terang](dashboard-light.png)
- [Dashboard seluler](dashboard-mobile.png)
- [Reduced motion](reduced-motion.png)

## Rujukan implementasi

- [GSAP Timeline](https://gsap.com/docs/v3/GSAP/Timeline/): penjadwalan kamera dan panel pada satu timeline.
- [React Three Fiber — Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance): demand rendering dan invalidation saat animasi imperatif.
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): persiapan shader melalui `compileAsync`.
- Panduan Next.js yang terpasang: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`.
