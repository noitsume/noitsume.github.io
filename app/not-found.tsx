import Link from "next/link";
export default function NotFound() {
  return <main className="recovery-page"><span className="recovery-mark" aria-hidden="true">✦</span><p className="ui-eyebrow">HALAMAN TIDAK DITEMUKAN</p><h1>Tautan ini belum bisa dibuka.</h1><p>Periksa kembali tautannya. Jika kamu menerima tautan hadiah, minta pengirim memastikan halaman masih tersedia.</p><Link className="ui-button ui-button--primary" href="/">Kembali ke Kenangin</Link></main>;
}
