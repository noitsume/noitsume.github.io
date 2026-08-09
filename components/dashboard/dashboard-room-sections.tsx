"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreateRoomLauncher, RoomSortSelect } from "@/components/rooms";
import {
  Badge,
  MoreIcon,
  PinIcon,
  SectionHeader,
  Surface,
} from "@/components/ui";
import { getCsrfToken } from "@/lib/auth/client";
import type { Room, Theme } from "@/lib/data/contracts";
import { getDashboardRoomStatus, type DashboardRoomStatus } from "@/lib/domain/room-status";
import type { RoomSortMode } from "@/lib/domain/room-sorting";

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function statusLabel(status: DashboardRoomStatus) {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "working":
      return "On Working";
    case "ended":
      return "Ended";
  }
}

function statusBadgeClass(status: DashboardRoomStatus) {
  if (status === "working") return "ui-badge--success";
  if (status === "ended") return "ui-badge--indigo";
  return "ui-badge--neutral";
}

function DashboardRoomCard({
  room,
  creatorName,
  busy,
  onTogglePin,
}: {
  room: Room;
  creatorName: string;
  busy: boolean;
  onTogglePin: (room: Room) => void;
}) {
  const derived = getDashboardRoomStatus(room);
  const expiryLabel = room.expiresAt
    ? formatDateLabel(room.expiresAt)
    : "Belum memiliki batas kadaluarsa";

  return (
    <Surface
      className="dashboard-room-card"
      tone="quiet"
      data-pinned={room.isPinned ? "true" : "false"}
    >
      <div className="dashboard-room-card__cover">
        <Badge className={`dashboard-room-card__status ${statusBadgeClass(derived)}`}>
          <span className="dashboard-room-card__status-dot" aria-hidden="true" />
          {statusLabel(derived)}
        </Badge>

        <button
          className="dashboard-room-card__pin"
          type="button"
          data-pinned={room.isPinned ? "true" : "false"}
          aria-label={room.isPinned ? `Lepas pin ${room.title}` : `Pin ${room.title}`}
          title={room.isPinned ? "Lepas dari Pinned" : "Pindahkan ke Pinned"}
          disabled={busy}
          onClick={() => onTogglePin(room)}
        >
          <PinIcon size={15} />
        </button>
      </div>

      <div className="dashboard-room-card__content">
        <h3>{room.title}</h3>
        <p className="dashboard-room-card__recipient">
          Dirayakan: <strong>{room.recipientName}</strong>
        </p>
        <p className="dashboard-room-card__expiry">
          Kadaluarsa: <span>{expiryLabel}</span>
        </p>

        <div className="dashboard-room-card__meta">
          <span>Pembuat</span>
          <strong>{creatorName}</strong>
        </div>

        <div className="dashboard-room-card__actions">
          <Link className="ui-button ui-button--secondary dashboard-room-card__open" href={`/rooms/${room.id}`}>
            Lihat Room
          </Link>
          <Link
            className="dashboard-room-card__more"
            href={`/rooms/${room.id}/edit`}
            aria-label={`Edit ${room.title}`}
          >
            <MoreIcon size={17} />
          </Link>
        </div>
      </div>
    </Surface>
  );
}

type DashboardRoomSectionsProps = {
  initialRooms: Room[];
  creatorName: string;
  sortMode: RoomSortMode;
  themes: Theme[];
  initialCreateOpen?: boolean;
};

export function DashboardRoomSections(props: DashboardRoomSectionsProps) {
  // A refreshed server payload gets a new revision key, remounting only the
  // stateful room section. This keeps optimistic local state without syncing
  // props back into state from an effect.
  const roomsRevision = props.initialRooms
    .map((room) => `${room.id}:${room.updatedAt}:${room.isPinned ? "1" : "0"}`)
    .join("|");

  return <DashboardRoomSectionsState key={roomsRevision} {...props} />;
}

function DashboardRoomSectionsState({
  initialRooms,
  creatorName,
  sortMode,
  themes,
  initialCreateOpen = false,
}: DashboardRoomSectionsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rooms, setRooms] = useState(initialRooms);
  const [busyRoomIds, setBusyRoomIds] = useState<Set<string>>(() => new Set());

  const pinnedRooms = useMemo(
    () => rooms.filter((room) => room.isPinned),
    [rooms],
  );

  const activeRooms = useMemo(
    () => rooms.filter((room) => !room.isPinned && getDashboardRoomStatus(room) !== "ended"),
    [rooms],
  );

  async function togglePinned(room: Room) {
    if (busyRoomIds.has(room.id)) return;

    const nextPinned = !room.isPinned;
    setBusyRoomIds((current) => {
      const next = new Set(current);
      next.add(room.id);
      return next;
    });

    // Move the card first, then persist. If the request fails, roll it back.
    setRooms((current) =>
      current.map((item) =>
        item.id === room.id ? { ...item, isPinned: nextPinned } : item,
      ),
    );

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${room.id}/pin`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({ pinned: nextPinned }),
      });

      if (!response.ok) throw new Error("Gagal mengubah status pin Room.");

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setRooms((current) =>
        current.map((item) =>
          item.id === room.id ? { ...item, isPinned: room.isPinned } : item,
        ),
      );
    } finally {
      setBusyRoomIds((current) => {
        const next = new Set(current);
        next.delete(room.id);
        return next;
      });
    }
  }

  return (
    <>
      <section className="dashboard-section" aria-labelledby="pinned-heading">
        <SectionHeader
          eyebrow="PILIHAN CEPAT"
          icon={<PinIcon size={16} />}
          title="Pinned"
          headingId="pinned-heading"
          action={<span className="section-note">{pinnedRooms.length} Room disematkan</span>}
        />
        {pinnedRooms.length > 0 ? (
          <div className="pinned-grid dashboard-room-grid">
            {pinnedRooms.map((room) => (
              <DashboardRoomCard
                key={room.id}
                room={room}
                creatorName={creatorName}
                busy={busyRoomIds.has(room.id)}
                onTogglePin={togglePinned}
              />
            ))}
          </div>
        ) : (
          <Surface className="dashboard-empty-state" tone="quiet">
            Belum ada Room yang disematkan. Pin Room penting agar muncul di sini.
          </Surface>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="active-heading">
        <SectionHeader
          eyebrow="WORKSPACE"
          title="Room Aktif"
          headingId="active-heading"
          action={<RoomSortSelect value={sortMode} />}
        />
        <div className="active-rooms-row dashboard-room-grid">
          <CreateRoomLauncher themes={themes} initialOpen={initialCreateOpen} />
          {activeRooms.map((room) => (
            <DashboardRoomCard
              key={room.id}
              room={room}
              creatorName={creatorName}
              busy={busyRoomIds.has(room.id)}
              onTogglePin={togglePinned}
            />
          ))}
        </div>
      </section>
    </>
  );
}
