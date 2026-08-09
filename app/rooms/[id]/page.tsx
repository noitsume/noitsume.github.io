import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RoomActions, RoomOpenTracker } from "@/components/rooms";
import { ArrowRightIcon, Badge, CalendarIcon, Surface } from "@/components/ui";
import type { Room } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import { getDashboardRoomStatus } from "@/lib/domain/room-status";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

export const metadata: Metadata = { title: "Room" };

type PageProps = { params: Promise<{ id: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function occasionLabel(value: string) {
  if (value === "birthday") return "Ulang Tahun";
  if (value === "graduation") return "Wisuda";
  if (value === "anniversary") return "Anniversary";
  return value;
}

function statusLabel(value: ReturnType<typeof getDashboardRoomStatus>) {
  if (value === "waiting") return "Waiting";
  if (value === "working") return "On Working";
  return "Ended";
}

export default async function RoomOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOwnerSession();
  if (!session) redirect(`/login?next=/rooms/${encodeURIComponent(id)}`);

  let room: Room;
  try {
    room = await getOwnedRoom(session.uid, id);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }

  const [user, theme] = await Promise.all([
    getOwnerShellUser(session),
    backendRepositories.themes.getTheme(room.themeId),
  ]);
  const derivedStatus = getDashboardRoomStatus(room);

  return (
    <AppShell user={user}>
      <RoomOpenTracker roomId={room.id} />
      <div className="room-page">
        <div className="room-page__breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <ArrowRightIcon size={13} />
          <span>{room.title}</span>
        </div>

        <Surface className="room-overview-hero" tone="elevated">
          <div className="room-overview-hero__topline">
            <Badge className={derivedStatus === "working" ? "ui-badge--success" : derivedStatus === "ended" ? "ui-badge--indigo" : "ui-badge--neutral"}>
              {statusLabel(derivedStatus)}
            </Badge>
            <span className="room-overview-hero__id">{room.id}</span>
          </div>
          <h1>{room.title}</h1>
          <p>Untuk <strong>{room.recipientName}</strong>. Room ini sudah terhubung ke Firestore dan dimiliki oleh akunmu.</p>
          <div className="room-overview-hero__actions">
            <Link className="ui-button ui-button--primary" href={`/rooms/${room.id}/edit`}><span>Edit Room</span></Link>
            <Link className="ui-button ui-button--ghost" href="/dashboard"><span>Kembali ke Dashboard</span></Link>
          </div>
        </Surface>

        <div className="room-overview-grid">
          <Surface className="room-overview-card" tone="quiet">
            <p className="ui-eyebrow">ROOM INFO</p>
            <dl className="room-overview-list">
              <div><dt>Penerima</dt><dd>{room.recipientName}</dd></div>
              <div><dt>Occasion</dt><dd>{occasionLabel(room.occasionId)}</dd></div>
              <div><dt>Theme</dt><dd>{theme?.name ?? room.themeId}</dd></div>
              <div><dt>Lifecycle</dt><dd>{room.status}</dd></div>
            </dl>
          </Surface>

          <Surface className="room-overview-card" tone="quiet">
            <p className="ui-eyebrow">COLLECTING</p>
            <div className="room-overview-deadline">
              <span className="room-overview-deadline__icon"><CalendarIcon size={18} /></span>
              <div><span>Deadline</span><strong>{formatDate(room.collectionDeadline)}</strong></div>
            </div>
            <p className="room-overview-note">Collector belum dibuka. ID Room dan collectorId sudah disiapkan agar alur pengumpulan dapat dilanjutkan tanpa membuat Room baru.</p>
          </Surface>
        </div>

        <Surface className="room-overview-manage" tone="quiet">
          <div>
            <p className="ui-eyebrow">MANAGE</p>
            <h2>Kontrol Room</h2>
            <p>Pin untuk akses cepat atau hapus Room jika memang tidak akan dipakai.</p>
          </div>
          <RoomActions roomId={room.id} pinned={room.isPinned} />
        </Surface>
      </div>
    </AppShell>
  );
}
