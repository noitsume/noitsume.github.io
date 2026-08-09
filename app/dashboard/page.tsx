import { AppShell } from "@/components/shell";
import {
  ArrowRightIcon,
  Badge,
  Button,
  CalendarIcon,
  MoreIcon,
  PinIcon,
  SectionHeader,
  SparklesIcon,
  Surface,
} from "@/components/ui";
import { repositories } from "@/lib/data/providers/repository-provider";
import { MOCK_USER_UID, createMockUser } from "@/lib/data/mock/seed";
import type { EventDefinition, Room } from "@/lib/data/contracts";

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function countdownLabel(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  return `${days} hari lagi`;
}

type DashboardDerivedStatus = "waiting" | "working" | "ended";

function deriveDashboardStatus(room: Room): DashboardDerivedStatus {
  if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) return "ended";
  if (!room.firstBakedAt) return "waiting";
  return "working";
}

function statusLabel(status: DashboardDerivedStatus) {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "working":
      return "On Working";
    case "ended":
      return "Ended";
  }
}

function occasionLabel(occasionId: string) {
  const map: Record<string, string> = {
    birthday: "Ulang Tahun",
    graduation: "Wisuda",
    anniversary: "Anniversary",
  };
  return map[occasionId] ?? occasionId;
}

function StatItem({ label, value, description, tone }: { label: string; value: number; description: string; tone: "coral" | "neutral" | "green" | "indigo" }) {
  return (
    <div className={`dashboard-stat dashboard-stat--${tone}`}>
      <div className={`dashboard-stat__orb dashboard-stat__orb--${tone}`} />
      <p className="ui-eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{description}</span>
    </div>
  );
}

function EventCard({ event }: { event: EventDefinition }) {
  return (
    <Surface className="event-card" tone="quiet">
      <div className={`event-card__icon event-card__icon--${event.accent}`} />
      <div className="event-card__body">
        <h3>{event.title}</h3>
        <p>{formatDateLabel(event.date)}</p>
      </div>
      <Badge className={event.accent === "green" ? "ui-badge--success" : "ui-badge--amber"}>{countdownLabel(event.date)}</Badge>
    </Surface>
  );
}

function PinnedRoomCard({ room }: { room: Room }) {
  const derived = deriveDashboardStatus(room);
  return (
    <Surface className="pinned-room-card" tone="elevated">
      <div className="pinned-room-card__cover">
        <Badge className={derived === "working" ? "ui-badge--success" : derived === "waiting" ? "ui-badge--neutral" : "ui-badge--indigo"}>{statusLabel(derived)}</Badge>
        <button className="pinned-room-card__pin" type="button" aria-label="Room disematkan">
          <PinIcon size={14} />
        </button>
      </div>
      <div className="pinned-room-card__content">
        <h3>{room.title}</h3>
        <dl>
          <div>
            <dt>Dirayakan</dt>
            <dd><strong>{room.recipientName}</strong></dd>
          </div>
          <div>
            <dt>Kadaluarsa</dt>
            <dd>{formatDateLabel(room.expiresAt ?? room.collectionDeadline)}</dd>
          </div>
          <div>
            <dt>Pembuat</dt>
            <dd>Kevin</dd>
          </div>
        </dl>
        <div className="pinned-room-card__actions">
          <Button className="pinned-room-card__button">Lihat Room</Button>
          <button className="pinned-room-card__more" type="button" aria-label="Opsi lainnya">
            <MoreIcon size={16} />
          </button>
        </div>
      </div>
    </Surface>
  );
}

function ActiveRoomCard({ room }: { room: Room }) {
  const derived = deriveDashboardStatus(room);
  return (
    <Surface className="active-room-card" tone="quiet">
      <Badge className={derived === "working" ? "ui-badge--success" : derived === "waiting" ? "ui-badge--neutral" : "ui-badge--indigo"}>{statusLabel(derived)}</Badge>
      <h3>{room.title}</h3>
      <p>{occasionLabel(room.occasionId)}</p>
      <p>{formatDateLabel(room.expiresAt ?? room.collectionDeadline)}</p>
      <div className="active-room-card__meta">
        <span>Pembuat</span>
        <strong>Kevin</strong>
      </div>
    </Surface>
  );
}

export default async function DashboardFoundationPage() {
  const user = (await repositories.users.getUser(MOCK_USER_UID)) ?? createMockUser();
  const rooms = await repositories.rooms.listRooms(MOCK_USER_UID);
  const events = await repositories.events.listEvents("ID");

  const pinnedRooms = rooms.filter((room) => room.isPinned).slice(0, 2);
  const activeRooms = rooms.filter((room) => !room.isPinned && deriveDashboardStatus(room) !== "ended");
  const recentRooms = [...rooms]
    .filter((room) => room.lastOpenedAt)
    .sort((a, b) => new Date(b.lastOpenedAt ?? 0).getTime() - new Date(a.lastOpenedAt ?? 0).getTime())
    .slice(0, 3);

  const stats = {
    total: rooms.length,
    waiting: rooms.filter((room) => deriveDashboardStatus(room) === "waiting").length,
    working: rooms.filter((room) => deriveDashboardStatus(room) === "working").length,
    ended: rooms.filter((room) => deriveDashboardStatus(room) === "ended").length,
  };

  const rightRail = (
    <div className="dashboard-rail">
      <Surface className="dashboard-rail__panel" tone="elevated">
        <div className="rail-label-row">
          <span className="ui-eyebrow">RIWAYAT</span>
          <Badge>{Math.min(recentRooms.length, 3)} / 3</Badge>
        </div>
        <h3>Room Terakhir Dibuka</h3>
        <ol className="history-list">
          {recentRooms.map((room, index) => (
            <li key={room.id} className="history-list__item">
              <span className="history-list__index">{index + 1}</span>
              <div>
                <strong>{room.title}</strong>
                <p>Terakhir dibuka {index + 1} hari lalu</p>
              </div>
              <ArrowRightIcon size={16} />
            </li>
          ))}
        </ol>
      </Surface>

      <Surface className="dashboard-rail__panel" tone="quiet">
        <div className="rail-label-row">
          <span className="ui-eyebrow">7 HARI TERAKHIR</span>
          <Badge className="ui-badge--success">LIVE</Badge>
        </div>
        <h3>Penonton Final</h3>
        <div className="viewer-hero">
          <strong>0</strong>
          <span>orang menonton final</span>
        </div>
        <div className="viewer-chart" aria-label="Grafik 7 hari terakhir">
          {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((day) => (
            <div key={day} className="viewer-chart__day">
              <span className="viewer-chart__value">0</span>
              <span className="viewer-chart__dot" />
              <small>{day}</small>
            </div>
          ))}
        </div>
        <p className="viewer-chart__note">Belum ada pembanding</p>
        <div className="viewer-metrics">
          <div>
            <span>Link final dibuka</span>
            <strong>0 orang</strong>
          </div>
          <div>
            <span>Menonton final</span>
            <strong>0 orang</strong>
          </div>
        </div>
        <p className="viewer-footnote">Dihitung dari pembukaan link dan tontonan Receiver yang sudah memenuhi ambang.</p>
      </Surface>
    </div>
  );

  return (
    <AppShell user={user} rightRail={rightRail}>
      <div className="dashboard-page">
        <Surface className="dashboard-hero" tone="elevated">
          <div className="dashboard-hero__copy">
            <p className="ui-eyebrow">KENANGIN · USER DASHBOARD</p>
            <div className="dashboard-hero__title-row">
              <h1>Dashboard User</h1>
              <span className="dashboard-hero__spark"><SparklesIcon size={22} /></span>
            </div>
            <p>
              Kelola room, pantau submission, dan siapkan kejutan personal dari satu workspace yang rapi dan terorganisir.
            </p>
          </div>

          <div className="dashboard-stats">
            <StatItem label="Total Room" value={stats.total} description="Seluruh workspace" tone="coral" />
            <StatItem label="Waiting" value={stats.waiting} description="Belum melakukan Bake pertama" tone="neutral" />
            <StatItem label="On Working" value={stats.working} description="Sudah melakukan Bake pertama" tone="green" />
            <StatItem label="Ended" value={stats.ended} description="Sudah melewati kadaluarsa" tone="indigo" />
          </div>
        </Surface>

        <section className="dashboard-section" aria-labelledby="upcoming-heading">
          <SectionHeader
            eyebrow="OTOMATIS"
            icon={<CalendarIcon size={16} />}
            title="Event Mendatang"
            headingId="upcoming-heading"
            action={<span className="section-note">Dihitung otomatis dari tanggal hari ini</span>}
          />
          <div className="events-grid">
            {events.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="pinned-heading">
          <SectionHeader
            eyebrow="PILIHAN CEPAT"
            icon={<PinIcon size={16} />}
            title="Pinned"
            headingId="pinned-heading"
            action={<span className="section-note">{pinnedRooms.length} Room disematkan</span>}
          />
          <div className="pinned-grid">
            {pinnedRooms.map((room) => (
              <PinnedRoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="active-heading">
          <SectionHeader
            eyebrow="WORKSPACE"
            icon={<SparklesIcon size={16} />}
            title="Room Aktif"
            headingId="active-heading"
            action={<span className="section-note">Urutkan: Terbaru</span>}
          />
          <div className="active-rooms-row">
            <Surface className="create-room-card" tone="quiet">
              <div className="create-room-card__plus">+</div>
              <h3>Buat Room</h3>
              <p>Mulai workspace baru untuk event berikutnya.</p>
            </Surface>
            {activeRooms.map((room) => (
              <ActiveRoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
