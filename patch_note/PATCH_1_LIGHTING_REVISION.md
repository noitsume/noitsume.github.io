# Patch 1 Lighting Revision — Spreading / Volumetric Light

Revisi ini hanya mengubah sistem ambient lighting. Layout, navbar, sidebar, card, typography, palette utama, routing, repository, dan scope Patch 1 tetap sama.

## Masalah versi sebelumnya

Screenshot penggunaan nyata memperlihatkan beam sudah muncul, tetapi silhouette cahaya masih terbaca seperti dua polygon/segitiga besar. Blur saja tidak cukup karena sumber masalahnya adalah geometri `clip-path` itu sendiri.

## Implementasi baru

- Tidak ada lagi `clip-path: polygon(...)` pada lamp beam.
- Inner light dibangun dari beberapa elongated `radial-gradient()` yang overlap.
- Setiap lobe makin besar dan makin redup semakin jauh dari sumber.
- Ambient spill terpisah untuk memberi kesan pantulan pada dinding.
- Lower wall-bounce sangat tipis menghilangkan kesan beam berhenti mendadak.
- Micro volumetric haze memakai procedural noise yang dimask hanya di area cahaya.
- Lamp kiri dan kanan tidak identik dalam lebar, rotasi, spill, dan intensity.
- Steady-state brightness diturunkan agar lighting tetap menjadi ambience.
- Mobile memakai spread yang lebih lebar dan intensity lebih rendah.

## Flicker baru

Flicker dibagi menjadi dua respons:

1. `source/core`: berkedip cepat dan jelas, termasuk sedikit perubahan bloom/scale.
2. `volume`: opacity berubah lebih lambat dan lebih kecil sehingga seluruh dinding tidak blackout secara kasar.

Sequence produk tetap sama:

- Light → Dark: radial reveal → source/volume flicker ON → settle.
- Dark → Light: source/volume flicker OFF → lamp benar-benar padam → radial reveal.

## Target visual

Yang harus terbaca adalah **dinding yang tersinari secara menyebar**, bukan sebuah shape cahaya. Tidak seharusnya ada garis diagonal lurus yang bisa diikuti mata dari atas sampai bawah.
