# Seleksi kiriman dan alur Studio

## Pemilik Room

- Setiap kiriman ditinjau sendiri. Semua media awalnya dicentang; hapus centang untuk menolak file tersebut. Ukuran per file dan total kiriman tersedia.
- Buka **Lihat utuh / Putar video** untuk preview penuh, berpindah antar media, dan mengubah checkbox. URL privat diperbarui setiap membuka preview agar sesi lama tetap dapat dipakai.
- **Simpan pilihan** menampilkan jumlah diterima/dihapus serta daftar file yang akan dihapus. Belum ada penghapusan ketika checkbox diubah atau konfirmasi dibatalkan.
- Konfirmasi menerima media dicentang, menghapus media lainnya secara permanen, dan mempertahankan ucapan. Jika semua media ditolak tanpa ucapan, kiriman ditandai `excluded` dengan daftar media kosong. **Hapus kiriman** juga menghapus ucapan dan dokumen kiriman.
- Media yang sudah diterima tetap dilindungi dari penghapusan melalui moderasi agar terbitan lama tidak kehilangan file.

## Konsistensi penyimpanan

`POST /api/rooms/[id]/submissions/actions` tetap mendukung `approve`, `exclude`, dan `delete`. Untuk seleksi per file, kirim satu `submissionIds` dengan `action: approve` dan `acceptedMediaIds` (termasuk `[]`). Tanpa field ini, `approve` menerima seluruh kiriman seperti sebelumnya.

1. Transaksi Firestore mencatat keputusan pada `submission.moderation`. ID media harus milik kiriman tersebut. Keputusan berbeda dari tab lain ditolak sebelum operasi B2.
2. File diterima disalin ke `rooms/<room>/media/` dan ukuran/tipe hasilnya diverifikasi. Destinasi yang sudah ada memungkinkan retry setelah sumber dibersihkan.
3. Semua versi B2 file ditolak, salinan permanen sisa percobaan lama, dan seluruh prefix staging kiriman dibersihkan. Kegagalan cleanup tidak boleh dilaporkan sebagai sukses.
4. Satu transaksi Firestore menghapus dokumen media ditolak (termasuk format lama), membersihkan metadata staging, menulis media diterima, dan menyelesaikan status kiriman.

Firestore dan B2 tidak memiliki transaksi bersama. Jika terjadi kegagalan di tengah proses, keputusan tetap tersimpan dan UI menyediakan **Lanjutkan penyimpanan** dengan pilihan yang sama. Jangan mengosongkan `moderation` secara manual: beberapa sumber mungkin sudah dihapus. Counter kuota pengumpulan tetap mengikuti batas kiriman masuk yang sudah ada.

## Studio setelah review

**Momen → Atur Cerita → Musik → Pratinjau & Suasana.**

Media yang diterima menjadi bahan section milik pemilik Room. Editor dimulai kosong;
rekomendasi susunan hanya dibuat jika diminta. Petunjuk digabung menjadi penekanan
opsional per section, dan gaya/final menjadi pratinjau interaktif. Lihat
[perilaku Studio terkini](studio-authoring.md).

## Verifikasi

`npm test` mencakup seleksi sebagian, tidak menerima media, ucapan saja, format kiriman lama, penolakan akses/ID asing, konflik dua tab, retry setelah B2/Firestore gagal, dan penghapusan seluruh versi serta delete marker B2. Pengujian ini memakai adapter terisolasi, tanpa menghapus data produksi.

QA browser lokal menggunakan komponen sebenarnya dengan respons API dummy: checkbox dan ringkasan konfirmasi, foto utuh, pemutaran video, retry, alur Studio maju/mundur, pemulihan draf, dan layout desktop/ponsel 320–390 px. Fixture sementara dihapus sebelum build produksi.
