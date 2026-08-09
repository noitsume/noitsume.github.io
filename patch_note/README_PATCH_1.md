# Kenangin — Patch 1

Patch 1 adalah overlay lanjutan dari Patch 0. Extract seluruh isi ZIP ke root project Next.js yang sudah menerima Patch 0 lalu pilih **Replace/Overwrite**.

## Isi Patch 1

- Design tokens dark/light Kenangin.
- Brand config terpusat.
- Reusable UI primitives: Surface, Button, IconButton, Badge, Avatar, SectionHeader, Tooltip, Skeleton, EmptyState, Toast, Dropdown, ContextMenu, Modal.
- Internal SVG icon set tanpa dependency icon tambahan.
- Responsive `AppShell` dengan sticky navbar, left navigation, main content, right rail, serta mobile drawer.
- Local date/time widget menggunakan `Intl.DateTimeFormat` dan update per menit.
- Profile container siap diganti ke Firebase user pada Patch 2.
- Ambient page background dengan subtle procedural grain.
- Dua ambient spreading light dark mode tanpa image asset; tidak memakai polygon/segitiga hard-edge.
- ThemeProvider dengan saved/system preference.
- Light → Dark: circular reveal, kemudian source-focused lamp flicker ON dan volumetric spread settle.
- Dark → Light: source-focused lamp flicker OFF, volume light memudar, mati total, kemudian circular reveal.
- View Transition API circular reveal ketika tersedia dan fallback overlay ketika tidak tersedia.
- `prefers-reduced-motion` support.
- `/` redirect ke `/dashboard`.
- `/dashboard` berisi visual-system preview; Dashboard data final baru masuk Patch 2.

## Cara pasang

1. Backup/commit project terlebih dahulu.
2. Extract ZIP ke root project.
3. Replace file yang bentrok.
4. Hapus `.next` bila project sedang/pernah dijalankan.
5. Jalankan:

```bash
npm install
npm run check
npm run dev
```

6. Buka `http://localhost:3000/dashboard`.
7. Tes tombol sun/moon dari desktop dan mobile viewport.

## Batas Patch 1

Patch ini sengaja belum menghubungkan Firebase/Auth/Firestore dan belum membangun kartu Dashboard final. `Kevin` masih berasal dari repository mock Patch 0. Patch 2 akan mengganti sumber datanya dengan backend tanpa mengganti AppShell atau Theme Engine.


## Lighting Revision — Soft Spreading / Volumetric

Revisi ini menggantikan spotlight geometris Patch 1 audited sebelumnya. Layout/UI lain tidak diubah.

Perubahan khusus lighting:

- menghapus `clip-path: polygon(...)` dari beam;
- beam dibangun dari beberapa elongated radial falloff yang bertumpuk;
- source/core lebih kecil dan lebih terang, tetapi tidak membentuk benda lampu;
- ambient spill melebar ke dinding lalu kehilangan intensitas secara gradual;
- lower bounce sangat tipis agar cahaya terasa menyentuh ruang, bukan sekadar gradient;
- volumetric haze sangat tipis hanya di dalam area cahaya;
- kiri/kanan sengaja tidak identik;
- settled brightness diturunkan agar tidak mengalahkan card;
- flicker utama sekarang terjadi pada source/core, sementara volume beam merespons lebih lambat;
- mobile memakai spread lebih lebar dengan intensity lebih rendah.

Target visualnya adalah **area dinding yang tersinari dan menyebar**, bukan dua segitiga spotlight.
