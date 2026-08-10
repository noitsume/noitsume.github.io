import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RoomProgress } from "@/components/rooms";
import { SettingsStudio } from "@/components/studio";
import { ArrowRightIcon, Badge } from "@/components/ui";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import { getOwnedWorkspaceMedia } from "@/lib/collector";
import type { Room } from "@/lib/data/contracts";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";
import { getRoomStudioConfig, listOwnedRoomMusic } from "@/lib/studio/service";

export const metadata: Metadata = { title: "Settings Studio" };

type PageProps = { params: Promise<{ id: string }> };

export default async function RoomStudioPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOwnerSession();
  if (!session) redirect(`/login?next=/rooms/${encodeURIComponent(id)}/studio`);

  let room: Room;
  try {
    room = await getOwnedRoom(session.uid, id);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }

  if (room.status === "collecting" || room.status === "closed") {
    redirect(`/rooms/${encodeURIComponent(room.id)}`);
  }
  if (room.status === "baking") {
    redirect(`/rooms/${encodeURIComponent(room.id)}/bake`);
  }
  if (room.status === "ready") {
    redirect(`/rooms/${encodeURIComponent(room.id)}/finish`);
  }

  const [user, workspace, roomMusic] = await Promise.all([
    getOwnerShellUser(session),
    getOwnedWorkspaceMedia(session.uid, room.id),
    listOwnedRoomMusic(session.uid, room.id),
  ]);
  if (!user) redirect(`/onboarding?next=${encodeURIComponent(`/rooms/${id}/studio`)}`);

  const submissionStatusById = new Map(workspace.submissions.map((item) => [item.id, item.status]));
  const inventoryMedia = workspace.media
    .filter((item) => item.source === "owner" || !item.submissionId || submissionStatusById.get(item.submissionId) === "approved")
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  const studio = getRoomStudioConfig(room);

  return (
    <AppShell user={user}>
      <div className="room-page room-workspace studio-page">
        <div className="room-page__breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <ArrowRightIcon size={13} />
          <Link href={`/rooms/${room.id}`}>{room.title}</Link>
          <ArrowRightIcon size={13} />
          <span>Settings Studio</span>
        </div>

        <header className="room-workspace-header studio-page__header">
          <div className="room-workspace-header__copy">
            <div className="room-workspace-header__kicker"><span>Settings Studio</span><span aria-hidden="true">•</span><span>{inventoryMedia.length} media inventori</span></div>
            <div className="room-workspace-header__title-row"><h1>Susun experience {room.recipientName}</h1><Badge className="room-lifecycle-badge room-lifecycle-badge--configuring">Mengatur</Badge></div>
            <p>Pilih apa yang masuk, beri guidance bila perlu, siapkan musik, lalu biarkan Experience Director menyusun tuning tiap section.</p>
          </div>
          <div className="room-workspace-header__actions"><Link className="ui-button ui-button--ghost" href={`/rooms/${room.id}`}>Kembali ke Workspace</Link></div>
        </header>

        <RoomProgress status={room.status} />

        <SettingsStudio
          initialRoomMusic={roomMusic}
          initialStudio={studio}
          media={inventoryMedia}
          previewUrlByMediaId={workspace.previewUrlByMediaId}
          recipientName={room.recipientName}
          roomId={room.id}
        />
      </div>
    </AppShell>
  );
}
