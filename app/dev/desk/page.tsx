import { notFound } from "next/navigation";
import { DashboardBackground } from "@/components/dashboard/dashboard-background";
import { DashboardRoomSections } from "@/components/dashboard/dashboard-room-sections";
import { AppShell } from "@/components/shell";
import { curatedThemes } from "@/config/themes";
import { roomSchema } from "@/lib/data/contracts/room";
import { DeskLabControls } from "./controls";

/** Local visual fixture; no real account, media, or mutations are required. */
export default function DeskLab() {
  if (process.env.NODE_ENV !== "development") notFound();
  const stamp = "2026-10-12T08:00:00.000Z";
  const rooms = [
    ["Untuk hari yang selalu kita ingat", "Sahabat", "collecting"],
    ["Selamat atas langkah barumu", "Teman", "configuring"],
    ["Cerita yang tetap tinggal", "Keluarga", "ready"],
  ].map(([title, recipientName, status], i) => roomSchema.parse({
    id: `room_desk_fixture_${i}`, ownerUid: "desk-fixture", title, recipientName, occasionId: "birthday", eventId: null,
    themeId: curatedThemes[i].id, customThemeNameRaw: null, status, collectorId: `collector_fixture_${i}`,
    receiverId: null, collectionDeadline: "2026-12-20T00:00:00.000Z", config: null,
    firstBakedAt: null, lastBakedAt: null, expiresAt: null, isPinned: false, lastOpenedAt: null,
    schemaVersion: 1, createdAt: stamp, updatedAt: stamp,
  }));
  return <AppShell className="app-shell--desk-studio" background={<DashboardBackground />}
    user={{ displayName: "Preview lokal", email: "fixture@example.invalid" }}
    rightRail={<div className="dashboard-rail"><div className="ui-surface dashboard-rail__panel"><p className="ui-eyebrow">PREVIEW LOKAL</p><h3>Meja kenangan</h3><p className="dashboard-empty-copy">Konten contoh untuk memeriksa cahaya, gerak, dan keterbacaan.</p><DeskLabControls /></div></div>}>
    <div className="dashboard-page">
      <div className="ui-surface dashboard-hero">
        <div className="dashboard-hero__copy"><p className="ui-eyebrow">RUANG UNTUK YANG BERARTI</p><div className="dashboard-hero__title-row"><h1>Kenangan kecil, berarti besar.</h1></div><p>Kumpulkan cerita dari orang terdekat. Rangkai menjadi kejutan yang akan selalu diingat.</p></div>
        <div className="dashboard-stats">{["Total Room", "Disiapkan", "Diterbitkan", "Berakhir"].map((label, i) => <div className="dashboard-stat" key={label}><p className="ui-eyebrow">{label}</p><strong>{[3, 2, 1, 0][i]}</strong><span>Data contoh</span></div>)}</div>
      </div>
      <DashboardRoomSections initialRooms={rooms} creatorName="Preview lokal" sortMode="newest" themes={curatedThemes} />
    </div>
  </AppShell>;
}
