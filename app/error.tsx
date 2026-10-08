"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="recovery-page"><span className="recovery-mark" aria-hidden="true">↻</span><p className="ui-eyebrow">KITA COBA LAGI</p><h1>Halaman belum berhasil dimuat.</h1><p>Periksa koneksimu, lalu coba sekali lagi. Pilihan yang sudah tersimpan tetap aman.</p><div><button className="ui-button ui-button--primary" onClick={reset} type="button">Muat ulang halaman</button><Link className="ui-button ui-button--ghost" href="/dashboard">Ke kenangan saya</Link></div></main>;
}
