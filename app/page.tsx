import { getDashboardRoomStatus } from "@/lib/domain/room-status";
import { createMockRooms } from "@/lib/data/mock/seed";

export default function Home() {
  const rooms = createMockRooms();
  const working = rooms.filter(
    (room) => getDashboardRoomStatus(room) === "working",
  ).length;

  return (
    <main className="foundation-page">
      <section className="foundation-card" aria-labelledby="patch-title">
        <div className="foundation-mark" aria-hidden="true" />
        <p className="eyebrow">KENANGIN · FOUNDATION</p>
        <h1 id="patch-title">Patch 0 berhasil terpasang.</h1>
        <p className="description">
          Kontrak domain, repository layer, mock seed, environment contract, dan
          quality scripts sudah siap. Visual Dashboard final dimulai pada patch
          berikutnya.
        </p>

        <dl className="foundation-stats">
          <div>
            <dt>Seed Room</dt>
            <dd>{rooms.length}</dd>
          </div>
          <div>
            <dt>On Working</dt>
            <dd>{working}</dd>
          </div>
          <div>
            <dt>Data Source</dt>
            <dd>Mock Repository</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
