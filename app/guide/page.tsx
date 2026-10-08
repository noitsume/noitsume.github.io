import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { PageHeading } from "@/components/ui/page-heading";
import { getOwnerSession } from "@/lib/auth/session";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
export const metadata = { title: "Panduan Kenangin" };
const steps = [
  ["Buat ruangnya", "Tentukan untuk siapa kejutan ini dibuat, pilih suasana, dan tentukan batas pengumpulan. Room adalah tempat semua kenangan berkumpul."],
  ["Ajak orang terdekat", "Salin tautan pengumpulan dari halaman Room. Teman dan keluarga bisa mengirim ucapan, foto, atau video tanpa membuat akun."],
  ["Pilih momen", "Terima kiriman yang ingin disertakan. Kamu juga bisa menambahkan foto dan video sendiri. Tutup pengumpulan setelah semuanya masuk."],
  ["Rangkai ceritanya", "Studio membimbingmu memilih media, memberi petunjuk cerita bila perlu, memilih musik, dan menentukan satu gaya favorit."],
  ["Terbitkan & bagikan", "Tinjau pilihanmu, lalu terbitkan. Buka pratinjau sebelum membagikan tautan kejutan kepada penerima. Tautannya tetap sama saat ceritanya diperbarui."],
];
export default async function GuidePage() {
  const session = await getOwnerSession();
  if (!session) redirect("/login?next=/dashboard");
  const user = await getOwnerShellUser(session);
  if (!user) redirect("/onboarding?next=/dashboard");
  return <AppShell user={user}><div className="room-page"><PageHeading eyebrow="SEDIKIT BANTUAN" title="Dari kenangan, jadi kejutan." description="Lima langkah yang bisa kamu lanjutkan pelan-pelan. Tidak perlu menyelesaikan semuanya sekaligus." />
<div className="guide-grid">{steps.map(([title, text], index) => <article className="guide-step" key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</div>
<div className="guide-faq"><h2>Yang sering ditanyakan</h2>
<details><summary>Siapa yang dapat melihat foto dan ucapan?</summary><p>Pembuat Room dapat meninjau semua kiriman. Setelah diterbitkan, siapa pun yang memiliki tautan kejutan dapat melihat media dan ucapan yang dipilih. Bagikan tautan hanya kepada orang yang kamu tuju.</p></details>
<details><summary>Apa perbedaan tautan pengumpulan dan tautan kejutan?</summary><p>Tautan pengumpulan menerima kiriman sebelum ceritanya selesai. Tautan kejutan menampilkan cerita yang sudah kamu terbitkan. Kedua tautan ditandai terpisah di halaman Room dan halaman selesai.</p></details>
<details><summary>Bisakah ceritanya diubah setelah terbit?</summary><p>Bisa. Pilih Ubah cerita di halaman selesai. Versi sebelumnya tetap dapat ditonton sampai versi baru berhasil diterbitkan, dan tautan penerima tetap sama.</p></details>
<details><summary>Apa batas kiriman dan pembuatan gaya cerita?</summary><p>Setiap kiriman menerima hingga 8 file: foto 20 MB, video 200 MB, dengan total 600 MB. Pengumpulan dibatasi 100 kiriman dan 2 GB per Room. Pembuatan gaya cerita dibatasi 20 kali per Room per hari untuk menjaga layanan tetap tersedia.</p></details>
<details><summary>Musik atau video tidak langsung berbunyi?</summary><p>Tekan Buka kejutan terlebih dahulu. Bila browser masih menahan suara, tekan tombol Musik atau kontrol putar pada video. Foto dan ucapan tetap dapat dinikmati tanpa suara.</p></details>
<details><summary>Bagaimana menghapus Room?</summary><p>Buka menu tiga titik pada kartu Room di Kenangan saya, lalu pilih Hapus. Penghapusan membersihkan media dan menonaktifkan tautan. Data yang dihapus tidak bisa dikembalikan.</p></details>
</div><Link className="ui-button ui-button--primary" href="/dashboard?create=1">Buat kenangan pertamamu →</Link></div></AppShell>;
}
