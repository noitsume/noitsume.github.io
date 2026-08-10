import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RoomProgress } from "@/components/rooms";
import { BakeProgressShell } from "@/components/studio";
import { ArrowRightIcon } from "@/components/ui";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import type { Room } from "@/lib/data/contracts";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

export const metadata: Metadata = { title: "Bake Receiver" };
type PageProps = { params: Promise<{ id: string }> };

export default async function BakePage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOwnerSession();
  if (!session) redirect(`/login?next=/rooms/${encodeURIComponent(id)}/bake`);
  let room: Room;
  try { room = await getOwnedRoom(session.uid, id); } catch (error) { if (error instanceof ApiError) notFound(); throw error; }
  if (room.status === "ready") redirect(`/rooms/${room.id}/finish`);
  if (room.status !== "baking") redirect(`/rooms/${room.id}/studio`);
  const user = await getOwnerShellUser(session);
  if (!user) redirect(`/onboarding?next=${encodeURIComponent(`/rooms/${id}/bake`)}`);

  return <AppShell user={user}><div className="room-page room-workspace bake-page"><div className="room-page__breadcrumb"><Link href="/dashboard">Dashboard</Link><ArrowRightIcon size={13} /><Link href={`/rooms/${room.id}`}>{room.title}</Link><ArrowRightIcon size={13} /><span>Bake</span></div><RoomProgress status={room.status} /><BakeProgressShell roomId={room.id} /></div></AppShell>;
}
