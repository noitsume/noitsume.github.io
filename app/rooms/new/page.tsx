import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { RoomForm } from "@/components/rooms";
import { ArrowRightIcon, SparklesIcon, Surface } from "@/components/ui";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";

export const metadata: Metadata = { title: "Buat Room" };

export default async function NewRoomPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/login?next=/rooms/new");

  const [user, themes] = await Promise.all([
    getOwnerShellUser(session),
    backendRepositories.themes.listThemes(),
  ]);

  return (
    <AppShell user={user}>
      <div className="room-page">
        <div className="room-page__breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <ArrowRightIcon size={13} />
          <span>Buat Room</span>
        </div>

        <Surface className="room-editor-hero" tone="elevated">
          <div>
            <p className="ui-eyebrow">NEW WORKSPACE</p>
            <div className="room-editor-hero__title">
              <h1>Buat Room baru</h1>
              <SparklesIcon size={21} />
            </div>
            <p>Mulai dari informasi inti. Collector, submission, dan pengalaman Receiver akan tumbuh dari Room ini.</p>
          </div>
          <span className="room-editor-hero__step">01 · Fondasi Room</span>
        </Surface>

        <Surface className="room-editor-card" tone="quiet">
          <RoomForm mode="create" themes={themes} />
        </Surface>
      </div>
    </AppShell>
  );
}
