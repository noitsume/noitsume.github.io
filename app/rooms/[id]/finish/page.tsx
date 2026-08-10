import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RoomProgress } from "@/components/rooms";
import { ReceiverFinishCard } from "@/components/studio";
import { ArrowRightIcon } from "@/components/ui";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import type { Room } from "@/lib/data/contracts";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

export const metadata: Metadata = { title: "Receiver Selesai" };
type PageProps = { params: Promise<{ id: string }> };

export default async function FinishPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getOwnerSession();
  if (!session) redirect(`/login?next=/rooms/${encodeURIComponent(id)}/finish`);
  let room: Room;
  try { room = await getOwnedRoom(session.uid, id); } catch (error) { if (error instanceof ApiError) notFound(); throw error; }
  if (room.status === "baking") redirect(`/rooms/${room.id}/bake`);
  if (room.status !== "ready" || !room.receiverId) redirect(`/rooms/${room.id}/studio`);
  const [user, requestHeaders] = await Promise.all([getOwnerShellUser(session), headers()]);
  if (!user) redirect(`/onboarding?next=${encodeURIComponent(`/rooms/${id}/finish`)}`);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const path = `/r/${room.receiverId}`;
  const receiverUrl = host ? `${protocol}://${host}${path}` : path;

  return <AppShell user={user}><div className="room-page room-workspace receiver-finish-page"><div className="room-page__breadcrumb"><Link href="/dashboard">Dashboard</Link><ArrowRightIcon size={13} /><Link href={`/rooms/${room.id}`}>{room.title}</Link><ArrowRightIcon size={13} /><span>Selesai</span></div><RoomProgress status={room.status} /><ReceiverFinishCard receiverId={room.receiverId} receiverUrl={receiverUrl} /></div></AppShell>;
}
