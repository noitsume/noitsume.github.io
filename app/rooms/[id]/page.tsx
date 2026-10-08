import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RoomWorkspaceLive } from "@/components/collector";
import { AppShell } from "@/components/shell";
import { RoomOpenTracker, RoomProgress } from "@/components/rooms";
import { PageHeading } from "@/components/ui/page-heading";
import type { Room } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import { getOwnedWorkspaceMedia } from "@/lib/collector";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

export const metadata: Metadata = { title: "Room Workspace" };

type PageProps = { params: Promise<{ id: string }> };

function occasionLabel(value: string) {
  if (value === "birthday") return "Ulang Tahun";
  if (value === "graduation") return "Wisuda";
  if (value === "anniversary") return "Anniversary";
  return value;
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

  return (
    <AppShell user={user} hideSidebar>
      <RoomOpenTracker roomId={room.id} />
      <div className="room-page room-workspace">
        <PageHeading title={room.title} eyebrow="RUANG KENANGAN" description={"Sebuah kejutan untuk " + room.recipientName + ". Mulai dari satu momen, rangkai jadi cerita."} action={<Link className="ui-button ui-button--ghost" href={"/rooms/" + room.id + "/edit"}>Ubah detail</Link>} />

        <RoomProgress status={room.status} />

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

      </div>
    </AppShell>
  );
}
