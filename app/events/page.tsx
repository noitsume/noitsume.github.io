import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { PageHeading } from "@/components/ui/page-heading";
import { getOwnerSession } from "@/lib/auth/session";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
export const metadata = { title: "Momen Mendatang" };
export default async function EventsPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/login?next=/dashboard");
  const user = await getOwnerShellUser(session);
  if (!user) redirect("/onboarding?next=/dashboard");
const [events, rooms] = await Promise.all([backendRepositories.events.listEvents("ID"), backendRepositories.rooms.listRooms(session.uid)]);
const now = new Date().getTime();
const upcoming = rooms.filter(room => room.status === "collecting" && Date.parse(room.collectionDeadline) > now).map(room => ({ id: room.id, title: room.title, date: room.collectionDeadline, detail: "Batas pengumpulan untuk " + room.recipientName, href: "/rooms/" + room.id }));
const agenda = [...upcoming, ...events.map(event => ({ ...event, detail: "Momen bersama · Indonesia", href: "/dashboard?create=1" }))].sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
return <AppShell user={user}><div className="room-page"><PageHeading eyebrow="MASIH ADA WAKTU" title="Siapkan sesuatu yang berarti." description="Batas pengumpulan kenanganmu dan momen terdekat dalam satu tempat." /><div className="event-agenda">{agenda.map(event => <article key={event.id}><div><p className="ui-eyebrow">{new Intl.DateTimeFormat("id-ID",{ dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(event.date))}</p><h2>{event.title}</h2><p>{event.detail}</p></div><Link className="ui-button ui-button--secondary" href={event.href}>{event.href.includes("/rooms/") ? "Buka kenangan" : "Siapkan kejutan"} →</Link></article>)}</div>{!agenda.length ? <div className="workspace-panel"><h2>Belum ada momen terjadwal.</h2><p>Ulang tahun, wisuda, atau hari yang sederhana pun bisa jadi alasan untuk membuat kejutan.</p><Link className="ui-button ui-button--primary" href="/dashboard?create=1">Buat Room</Link></div> : null}</div></AppShell>;
}
