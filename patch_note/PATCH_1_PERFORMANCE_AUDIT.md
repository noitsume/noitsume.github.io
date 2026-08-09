# Patch 1 — Performance Audit & Scroll Optimization

## Gejala
Scroll pada Dashboard dapat terasa patah/frame-drop setelah lighting, grain, translucent surfaces, sticky navigation, dan seluruh skeleton Dashboard aktif bersamaan.

## Temuan utama
Bottleneck terbesar bukan jumlah React component, melainkan raster/compositing CSS:

1. Dua lampu fullscreen memakai beberapa `filter: blur(43–70px)` pada area sangat besar.
2. Lamp layer memakai `mix-blend-mode: screen`.
3. Grain global dan haze lamp memakai SVG `feTurbulence` procedural.
4. Flicker mengubah `filter: blur()` + `brightness()` pada setiap keyframe.
5. Hampir semua `Surface` menggunakan `backdrop-filter`, sehingga background harus disampling ulang ketika content scroll.
6. Sticky navbar juga menggunakan backdrop blur besar.

## Optimisasi yang diterapkan

### Ambient light
- Tetap mempertahankan spreading-light berbasis radial gradient.
- Menghapus realtime blur 43px/56px/70px dari area lamp besar.
- Menghapus `mix-blend-mode: screen` dari lamp.
- Flicker kini hanya memakai `opacity` dan `transform` (compositor-friendly).
- Haze procedural diganti gradient statis ringan.
- Ambient layer diberi containment dan layer promotion yang terbatas.

### Grain
- SVG `feTurbulence` global dihapus.
- Diganti `/public/kenangin-noise.png`, texture raster kecil yang di-repeat.
- Tidak memakai mix-blend untuk grain.

### Surfaces
- `backdrop-filter: blur(5px)` dihapus dari kartu Dashboard/Surface biasa.
- Visual translucent tetap dijaga lewat warna alpha/background gradient.
- `contain: paint` / layout containment dipakai pada kartu besar.

### Navbar
- Sticky navbar tidak lagi blur background secara realtime.
- Opacity background dinaikkan sedikit agar look tetap sama tanpa blur.

### Below-fold content
- Section Dashboard memakai `content-visibility: auto` dan intrinsic size.
- Browser dapat menunda paint section yang jauh di luar viewport.

### Mobile/coarse pointer
- Wall-bounce/haze lamp tambahan dimatikan pada viewport kecil/coarse device.
- Shadow surface diperingan.

## Audit rule count
Sebelum optimisasi:
- `filter: blur`: 58 occurrences
- `backdrop-filter`: 12 occurrences
- `mix-blend-mode`: 4 occurrences
- `feTurbulence`: 2 occurrences

Setelah optimisasi (remaining mostly popup/modal/fallback, bukan scrolling surface utama):
- `filter: blur`: 6 occurrences
- `backdrop-filter`: 5 occurrences
- `mix-blend-mode`: 1 occurrence (`normal` View Transition rule)
- `feTurbulence`: 0 occurrences

## Yang sengaja tidak diubah
- Layout Dashboard
- Spreading light shape/intensity utama
- Grain visual identity
- Theme radial reveal
- Lamp flicker sequence
- Sidebar/rail positioning
- Dashboard sections dan mock data
