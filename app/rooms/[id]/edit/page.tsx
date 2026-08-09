import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RoomForm } from "@/components/rooms";
import { ArrowRightIcon, Surface } from "@/components/ui";
import type { Room } from "@/lib/data/contracts";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

export const metadata: Metadata = { title: "Edit Room" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditRoomPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOwnerSession();
  if (!session) redirect(`/login?next=/rooms/${encodeURIComponent(id)}/edit`);

  let room: Room;
  try {
    room = await getOwnedRoom(session.uid, id);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }

  const [user, themes] = await Promise.all([
    getOwnerShellUser(session),
    backendRepositories.themes.listThemes(),
  ]);

  if (!user) redirect(`/onboarding?next=${encodeURIComponent(`/rooms/${id}/edit`)}`);

  return (
    <AppShell user={user}>
      <div className="room-page">
        <div className="room-page__breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <ArrowRightIcon size={13} />
          <Link href={`/rooms/${room.id}`}>{room.title}</Link>
          <ArrowRightIcon size={13} />
          <span>Edit</span>
        </div>

        <Surface className="room-editor-hero" tone="elevated">
          <div>
            <p className="ui-eyebrow">ROOM DETAILS</p>
            <div className="room-editor-hero__title"><h1>Edit Room</h1></div>
            <p>Ubah informasi dasar tanpa mengubah identitas Collector atau data Room yang sudah tersimpan.</p>
          </div>
        </Surface>

        <Surface className="room-editor-card" tone="quiet">
          <RoomForm mode="edit" themes={themes} room={room} />
        </Surface>
      </div>
    </AppShell>
  );
}
