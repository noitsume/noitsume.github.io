import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectorForm } from "@/components/collector";
import { AmbientBackground, ThemeToggle } from "@/components/theme";
import { CalendarIcon, LockIcon } from "@/components/ui";
import { brand } from "@/config/brand";
import { getCollectorRoom } from "@/lib/collector";
import { ApiError } from "@/lib/http";

export const metadata: Metadata = { title: "Collector" };

type PageProps = { params: Promise<{ collectorId: string }> };

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function occasionLabel(value: string) {
  if (value === "birthday") return "ulang tahun";
  if (value === "graduation") return "wisuda";
  if (value === "anniversary") return "anniversary";
  return "momen spesial";
}

export default async function CollectorPage({ params }: PageProps) {
  const { collectorId } = await params;
  let room;
  try {
    room = await getCollectorRoom(collectorId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const isOpen = room.status === "collecting";

  return (
    <div className="collector-page">
      <AmbientBackground />
      <header className="collector-navbar">
        <Link className="brand-lockup" href="/" aria-label={brand.name}>
          <span className="brand-mark" aria-hidden="true"><span>{brand.shortName}</span></span>
          <strong>{brand.name}</strong>
        </Link>
        <ThemeToggle />
      </header>

      <main className="collector-layout">
        <section className="collector-intro">
          <p className="ui-eyebrow">COLLECTOR ROOM</p>
          <h1>Simpan satu momen untuk <span>{room.recipientName}</span>.</h1>
          <p>Kamu sedang ikut menyiapkan kenangan untuk {occasionLabel(room.occasionId)} {room.recipientName}. Tulis ucapan, kirim foto, video, atau gabungkan semuanya.</p>
          <div className="collector-intro__deadline">
            <span><CalendarIcon size={17} /></span>
            <div><small>Batas pengumpulan</small><strong>{formatDeadline(room.collectionDeadline)}</strong></div>
          </div>
          <div className="collector-intro__privacy"><LockIcon size={15} /><span>Media disimpan privat dan hanya dapat direview oleh owner Room.</span></div>
        </section>

        <section className="collector-card">
          {isOpen ? (
            <>
              <div className="collector-card__heading">
                <p className="ui-eyebrow">KIRIM KENANGAN</p>
                <h2>Apa yang ingin kamu titipkan?</h2>
                <p>Minimal isi ucapan atau tambahkan satu media.</p>
              </div>
              <CollectorForm collectorId={collectorId} recipientName={room.recipientName} />
            </>
          ) : (
            <div className="collector-closed">
              <span className="collector-closed__icon"><LockIcon size={25} /></span>
              <p className="ui-eyebrow">COLLECTOR CLOSED</p>
              <h2>Pengumpulan sudah ditutup.</h2>
              <p>Kiriman untuk {room.recipientName} sudah masuk tahap berikutnya dan submission baru tidak dapat ditambahkan.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
