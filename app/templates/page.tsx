import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { PageHeading } from "@/components/ui/page-heading";
import { getOwnerSession } from "@/lib/auth/session";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { curatedThemes } from "@/config/themes";
export const metadata = { title: "Koleksi Tema" };
export default async function TemplatesPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/login?next=/dashboard");
  const user = await getOwnerShellUser(session);
  if (!user) redirect("/onboarding?next=/dashboard");
return <AppShell user={user}><div className="room-page"><PageHeading eyebrow="PILIH SUASANANYA" title="Setiap cerita punya rasa." description="Lima suasana untuk orang dan momen yang berbeda. Pilih temanya saat membuat Room atau mengatur cerita di Studio." />
<div className="theme-gallery">{curatedThemes.map(theme => <article key={theme.id}><div className="theme-gallery__preview" style={{ color: theme.palette.text, backgroundColor: theme.palette.background, backgroundImage: theme.assets.background.source === "public" ? 'url("' + theme.assets.background.publicPath + '")' : undefined }}><p>UNTUK YANG BERARTI</p><h2>{theme.name}</h2>{theme.assets.decorations[0]?.source === "public" ? (
// eslint-disable-next-line @next/next/no-img-element
<img alt="" src={theme.assets.decorations[0].publicPath} />) : null}</div><div className="theme-gallery__copy"><p>{theme.description}</p><Link className="ui-button ui-button--secondary" href="/dashboard?create=1">Buat Room →</Link></div></article>)}</div></div></AppShell>;
}
