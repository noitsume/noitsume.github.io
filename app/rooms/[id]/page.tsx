import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RoomWorkspaceLive } from "@/components/collector";
import { AppShell } from "@/components/shell";
import { RoomActions, RoomOpenTracker } from "@/components/rooms";
import { ArrowRightIcon, Badge, Surface } from "@/components/ui";
import type { Room, RoomStatus } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import { getOwnedWorkspaceMedia } from "@/lib/collector";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

export const metadata: Metadata = { title: "Room Workspace" };

type PageProps = { params: Promise<{ id: string }> };

const ROOM_STAGES: Array<{ id: RoomStatus; label: string; description: string }> = [
  { id: "collecting", label: "Mengumpulkan", description: "Kiriman masuk" },
  { id: "closed", label: "Ditutup", description: "Collector terkunci" },
  { id: "configuring", label: "Mengatur", description: "Kurasi pengalaman" },
  { id: "ready", label: "Siap", description: "Receiver tersedia" },
];

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function occasionLabel(value: string) {
  if (value === "birthday") return "Ulang Tahun";
  if (value === "graduation") return "Wisuda";
  if (value === "anniversary") return "Anniversary";
  return value;
}

function lifecycleLabel(value: RoomStatus) {
  return ROOM_STAGES.find((stage) => stage.id === value)?.label ?? value;
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

  const [user, theme, workspace, requestHeaders] = await Promise.all([
    getOwnerShellUser(session),
    backendRepositories.themes.getTheme(room.themeId),
    getOwnedWorkspaceMedia(session.uid, room.id),
    headers(),
  ]);
  if (!user) redirect(`/onboarding?next=${encodeURIComponent(`/rooms/${id}`)}`);

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const collectorPath = `/c/${room.collectorId}`;
  const collectorUrl = host ? `${protocol}://${host}${collectorPath}` : collectorPath;
  const activeStageIndex = Math.max(0, ROOM_STAGES.findIndex((stage) => stage.id === room.status));

  return (
    <AppShell user={user}>
      <RoomOpenTracker roomId={room.id} />
      <div className="room-page room-workspace">
        <div className="room-page__breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <ArrowRightIcon size={13} />
          <span>{room.title}</span>
        </div>

        <header className="room-workspace-header">
          <div className="room-workspace-header__copy">
            <div className="room-workspace-header__kicker">
              <span>Room workspace</span>
              <span aria-hidden="true">•</span>
              <span>Dibuat {formatCreatedAt(room.createdAt)}</span>
            </div>
            <div className="room-workspace-header__title-row">
              <h1>{room.title}</h1>
              <Badge className={`room-lifecycle-badge room-lifecycle-badge--${room.status}`}>{lifecycleLabel(room.status)}</Badge>
            </div>
            <p>
              Kenangan untuk <strong>{room.recipientName}</strong>. Kumpulkan momen, review yang masuk, lalu lanjutkan ke tahap penyusunan pengalaman.
            </p>
          </div>
          <div className="room-workspace-header__actions">
            <Link className="ui-button ui-button--primary" href={`/c/${room.collectorId}`} target="_blank">Buka Collector</Link>
            <Link className="ui-button ui-button--ghost" href={`/rooms/${room.id}/edit`}>Edit Room</Link>
          </div>
        </header>

        <Surface className="room-lifecycle" tone="quiet">
          <div className="room-lifecycle__track" aria-label={`Tahap Room: ${lifecycleLabel(room.status)}`}>
            {ROOM_STAGES.map((stage, index) => {
              const state = index < activeStageIndex ? "done" : index === activeStageIndex ? "active" : "upcoming";
              return (
                <div className={`room-lifecycle__segment room-lifecycle__segment--${state}`} key={stage.id}>
                  <div className="room-lifecycle__step">
                    <span className="room-lifecycle__dot">{state === "done" ? "✓" : index + 1}</span>
                    <div><strong>{stage.label}</strong><small>{stage.description}</small></div>
                  </div>
                  {index < ROOM_STAGES.length - 1 ? <span className="room-lifecycle__line" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </Surface>

        <RoomWorkspaceLive
          roomId={room.id}
          collectorId={room.collectorId}
          collectorUrl={collectorUrl}
          recipientName={room.recipientName}
          occasionName={occasionLabel(room.occasionId)}
          themeName={theme?.name ?? room.themeId}
          collectionDeadline={room.collectionDeadline}
          initialRoomStatus={room.status}
          initialWorkspace={workspace}
        />

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
