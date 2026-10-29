# Mengirim image Kenangin ke Docker Hub

Repository image: [hwrdfarr/kenangin](https://hub.docker.com/r/hwrdfarr/kenangin).
Repository kode: [noitsume/noitsume.github.io](https://github.com/noitsume/noitsume.github.io).
Branch perubahan ini: `docker-publish`.

Sintaks workflow lulus `actionlint`, dan publikasi aktual telah berhasil pada 29 Oktober 2026 melalui [workflow main ini](https://github.com/noitsume/noitsume.github.io/actions/runs/40745368660). Pengaturan berikut mendokumentasikan setup yang digunakan. Tahap berikutnya adalah [CD lokal di laptop](local-cd.md).

Perintah contoh dari Docker Hub, `docker push hwrdfarr/kenangin:tagname`, memakai `tagname` sebagai contoh tag. Workflow ini membuat tag `latest` serta `sha-<commit Git lengkap>`. Tidak perlu menjalankan perintah contoh itu sebelum image dibangun dan diberi tag yang sesuai.

## 1. Buat token Docker Hub

Masuk sebagai `hwrdfarr` di Docker Home. Pilih avatar → **Account settings → Personal access tokens → Generate new token**.

- Nama/deskripsi: `github-kenangin`.
- Pilih izin repository yang mendukung **Read & Write**, cukup untuk pull/push image; izin Delete tidak diperlukan.
- Tentukan masa berlaku sesuai kebutuhan tim, misalnya 30 hari.
- Salin token untuk dimasukkan langsung ke GitHub. Jangan tulis token di kode, laporan, atau chat.
github-kenangin
## 2. Simpan token di GitHub

Buka repo kode → **Settings → Secrets and variables → Actions → Secrets → New repository secret**.

| Nama secret | Nilai |
| --- | --- |
| `DOCKERHUB_TOKEN` | Token Docker Hub yang baru dibuat |

Username login `hwrdfarr` dan repository image sudah ditetapkan di workflow, sehingga tidak perlu membuat secret username tambahan.

## 3. Isi lima repository variables

Di halaman Actions settings yang sama, pilih **Variables → New repository variable**. Isi nilai dari lima baris `NEXT_PUBLIC_*` di `.env.local` proyek ini:

| Nama variable | Isi |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Origin aplikasi yang dibuka pengguna |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Konfigurasi Firebase Web dari `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Konfigurasi Firebase Web dari `.env.local` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Konfigurasi Firebase Web dari `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Konfigurasi Firebase Web dari `.env.local` |

Salin nilai saja, tanpa nama variabel, tanda `=`, atau tanda kutip pembungkus. Kelima nilai ini memang konfigurasi publik yang digunakan browser. Private key Firebase Admin, token B2, dan token Gemini tidak dimasukkan ke build image atau repository variables ini.

Target deployment yang dipilih adalah laptop, sehingga `NEXT_PUBLIC_APP_URL` menggunakan `http://localhost:3000`. Jika nanti berpindah ke server dengan alamat HTTPS, ganti variable ini lalu bangun/publikasikan ulang image sebelum deploy. Mengganti URL hanya saat runtime tidak memperbarui nilai yang sudah ditanamkan pada build Next.js.

## 4. Kirim perubahan workflow melalui pull request

Setelah secret dan variables diisi, gunakan terminal PowerShell VS Code di folder proyek:

```powershell
Set-Location -LiteralPath 'C:\Users\VICTUS\noitsume.github.io'
git branch --show-current
```

Hasil yang diharapkan: `docker-publish`.

```powershell
git add -- .github/workflows/ci.yml docs/container-ci.md docs/dockerhub.md
git diff --cached --name-only
git commit -m "Publish checked Docker images to Docker Hub"
git push -u origin docker-publish
```

Gunakan daftar file tersebut agar dokumen tugas dan media lokal tidak ikut terkirim. Buat pull request dengan **base `main`**, **compare `docker-publish`**. Pemeriksaan CI berjalan pada branch dan PR. Job publish berstatus **skipped** pada branch/PR; itu sesuai rancangan. Setelah ditinjau dan pemeriksaan lulus, merge ke `main`.

## 5. Periksa hasil publikasi

Merge ke `main` memicu workflow **CI - Test and Docker**:

1. `check-and-build`: lint, 74 tes yang ada, pemeriksaan TypeScript, build produksi, dan startup container.
2. `publish-dockerhub`: memeriksa konfigurasi, membangun image dengan konfigurasi publik, memeriksa startup image tersebut, login ke Docker Hub, lalu mengirim dua tag.

Jika konfigurasi kosong, job publish berhenti dengan nama setting yang perlu diisi. Setelah diperbaiki, buka **Actions → CI - Test and Docker → Run workflow**, pilih branch **main**, lalu jalankan kembali.

Di Docker Hub, buka repository **kenangin → Tags**. Setelah sukses, seharusnya tersedia:

```text
hwrdfarr/kenangin:latest
hwrdfarr/kenangin:sha-<commit Git lengkap>
```

`latest` mengikuti publikasi terbaru yang berhasil. Tag commit membantu memilih versi tertentu ketika deploy. Workflow menyertakan label sumber repo dan commit di image. Simpan link workflow dan tag/digest image sebagai bukti tugas.

Image dibangun untuk `linux/amd64`, sesuai runner Ubuntu x64. Jika nanti memakai server ARM, target build perlu disesuaikan sebelum deploy.

**Publikasi image sendiri belum men-deploy aplikasi.** Target akhir proyek ini adalah laptop Windows dengan Docker Desktop; langkah deployment dan pembaruan otomatis dijelaskan di [CD lokal](local-cd.md). Rahasia runtime tetap berada di laptop. Pemeriksaan startup hanya membuktikan halaman login merespons, belum membuktikan seluruh fitur cloud bekerja.

## Referensi

- [Token Docker Hub](https://docs.docker.com/security/access-tokens/personal-access-tokens/)
- [GitHub repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Next.js environment variables pada self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
