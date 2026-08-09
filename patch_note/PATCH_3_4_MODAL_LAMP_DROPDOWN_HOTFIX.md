# Patch 3.4 — Modal / Lamp / Dropdown Hotfix

## Perubahan
- Create Room modal dirender melalui React Portal ke `document.body` agar selalu viewport-centered dan berada di atas seluruh AppShell.
- Modal memakai z-index high overlay; tidak lagi terikat stacking context/grid Dashboard.
- Escape, close button, dan scrim menghapus query `create=1` secara konsisten.
- Lamp beam dibuat lebih cone-like memakai progressive radial lobes: makin ke bawah makin lebar.
- Tepi beam tetap feathered melalui radial falloff + radial mask; tidak memakai polygon/triangle hard edge.
- Tidak menambahkan blur filter besar pada lamp layer agar GPU cost tetap rendah di device lebih lemah.
- Profile dropdown menggunakan theme-tinted glass dengan sekitar 10% solid background opacity.
- Sort dropdown sekarang hanya `Terbaru`, `Terlama`, dan `Status`, tanpa description.

## Delta files
- app/globals.css
- components/rooms/create-room-modal.tsx
- components/rooms/room-sort-select.tsx
