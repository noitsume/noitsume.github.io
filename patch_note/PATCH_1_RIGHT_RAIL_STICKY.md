# Patch 1 — Right Rail Sticky Alignment

Perubahan ini menyamakan perilaku right rail dengan sidebar kiri pada desktop:

- `.app-shell__right` menjadi sticky pada `top: 92px`;
- tinggi dan batas viewport sama dengan sidebar kiri: `calc(100dvh - 116px)`;
- right rail tidak dapat naik ke balik/menabrak navbar;
- jika konten panel kanan lebih tinggi dari viewport, hanya rail kanan yang dapat discroll secara internal dan scrollbar disembunyikan;
- sticky dipindahkan dari `.dashboard-rail` ke wrapper `.app-shell__right` agar tidak terjadi nested sticky;
- pada breakpoint <=1320px, saat right rail turun menjadi section di bawah main, sticky otomatis dimatikan;
- tablet/mobile tetap menggunakan flow normal.
