# Kenangin Patch 1 — Audit Completion

Audit ini hanya menyentuh fondasi visual/interaksi Patch 1. Arah UI, layout, typography, palette, dan preview page dipertahankan.

## Temuan utama

### 1. Ambient light berada di belakang background halaman

Versi awal memakai `.ambient-background { z-index: -2; }` sementara `body` memiliki background solid. Pada browser/layout tertentu, ambient layer dapat terlukis di belakang background document sehingga cone light nyaris/tidak terlihat.

Perbaikan:

- `AppShell` sekarang membuat stacking context sendiri (`isolation: isolate`).
- ambient background berada pada layer `z-index: 0`.
- isi AppShell berada di atasnya pada layer `z-index: 1`.
- navbar tetap di layer sticky yang lebih tinggi.

### 2. Lamp terlalu bergantung pada satu gradient

Lamp dipecah menjadi tiga layer visual tanpa menampilkan benda lampu:

- `ambient-lamp__core`: sumber cahaya lembut di bagian atas.
- `ambient-lamp__cone`: sorotan directional yang melebar ke bawah.
- `ambient-lamp__spill`: ambient bounce/spill di sekitar cone.

Kedua lamp dibuat sedikit asimetris agar tidak terasa seperti efek mirror mekanis.

### 3. Flicker kurang terbaca

Sequence flicker diperpanjang menjadi 820ms dan kiri/kanan memakai pola berbeda. Flicker mengubah opacity dan brightness sehingga blackout/pulse terbaca, tetapi settle state tetap lembut.

Urutan tetap sesuai blueprint:

- Light → Dark: radial reveal → flicker lamp → lamp ON.
- Dark → Light: flicker lamp → lamp OFF → radial reveal.

### 4. Theme state hydration edge case

Toggle sekarang membaca `data-theme` yang sudah dipasang `ThemeScript` sebelum first paint ketika aksi dilakukan, sehingga klik yang sangat cepat setelah load tetap memakai theme nyata, bukan hanya state React awal.

`localStorage` juga dibuat fail-safe agar theme tetap bekerja ketika browser memblokir storage.

### 5. Mobile drawer interaction

Ditambahkan:

- body scroll lock saat drawer terbuka;
- Escape untuk menutup;
- focus diarahkan ke kontrol drawer ketika dibuka;
- hidden scrim tidak masuk tab order.

### 6. Profile/Dropdown/Context menu

Menu sekarang dismiss saat:

- klik/pointer di luar;
- tombol Escape.

Fokus kembali ke summary trigger setelah dismiss via Escape.

### 7. Accessibility minor completion

- `SectionHeader` menerima `headingId` sehingga `aria-labelledby` section dapat diarahkan ke heading sebenarnya.
- modal mempunyai `aria-labelledby` / `aria-describedby` dan dapat ditutup dari backdrop.
- backdrop-filter mendapat fallback surface untuk browser yang tidak mendukung blur.

## Tidak diubah

- layout visual Patch 1;
- typography;
- palette Coral/Amber;
- ukuran/radius card;
- bentuk navbar/sidebar;
- preview content;
- batas Patch 1: belum Firebase/Firestore dan belum Dashboard final.

## Verifikasi lokal paket

Audit paket menjalankan:

- transpile syntax untuk seluruh file TS/TSX non-declaration;
- pemeriksaan seluruh import internal `@/...`;
- pemeriksaan balance CSS braces;
- validasi seluruh JSON.

Full Next.js build tetap perlu dijalankan di environment project pengguna karena dependency registry environment pembuat paket tidak menyediakan seluruh versi package project.


## Lighting refinement setelah audit — spreading light

Screenshot pemakaian nyata menunjukkan versi audited pertama sudah tampil, tetapi tepi beam masih terbaca terlalu linear/geometris. Refinement berikut diterapkan tanpa mengubah layout utama:

1. `clip-path` polygon dihapus seluruhnya.
2. Directional volume sekarang memakai beberapa radial ellipse dengan ukuran/falloff berbeda.
3. Spill dan wall-bounce dipisahkan sehingga cahaya melebar secara bertahap.
4. Micro haze diberi mask hanya pada volume cahaya, dengan opacity sangat rendah.
5. Dua sumber dibuat sedikit asimetris dalam lebar, rotasi, dan intensitas.
6. Flicker dipisah menjadi `volume` dan `source`: source berkedip jelas, volume tidak blackout secara kasar.
7. Settle intensity diturunkan supaya pencahayaan hadir sebagai ambience, bukan elemen foreground.
8. Mobile spread diperlebar dan brightness diturunkan lagi.

Tidak ada perubahan pada navbar, sidebar, card preview, typography, radius, palette utama, routing, repository, atau batas scope Patch 1.
