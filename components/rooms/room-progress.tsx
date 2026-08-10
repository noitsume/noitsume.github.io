import type { RoomStatus } from "@/lib/data/contracts";
import { Surface } from "@/components/ui";

export const ROOM_PROGRESS_STAGES: Array<{
  id: RoomStatus;
  label: string;
  description: string;
}> = [
  { id: "collecting", label: "Mengumpulkan", description: "Kiriman masuk" },
  { id: "closed", label: "Ditutup", description: "Collector terkunci" },
  { id: "configuring", label: "Mengatur", description: "Settings Studio" },
  { id: "baking", label: "Bake", description: "Building page" },
  { id: "ready", label: "Selesai", description: "Preview + link" },
];

export function roomProgressLabel(status: RoomStatus) {
  return ROOM_PROGRESS_STAGES.find((stage) => stage.id === status)?.label ?? status;
}

export function RoomProgress({ status }: { status: RoomStatus }) {
  const activeStageIndex = Math.max(0, ROOM_PROGRESS_STAGES.findIndex((stage) => stage.id === status));

  return (
    <Surface className="room-lifecycle" tone="quiet">
      <div className="room-lifecycle__track" aria-label={`Tahap Room: ${roomProgressLabel(status)}`}>
        {ROOM_PROGRESS_STAGES.map((stage, index) => {
          const state = index < activeStageIndex ? "done" : index === activeStageIndex ? "active" : "upcoming";
          return (
            <div className={`room-lifecycle__segment room-lifecycle__segment--${state}`} key={stage.id}>
              <div className="room-lifecycle__step">
                <span className="room-lifecycle__dot">{state === "done" ? "✓" : index + 1}</span>
                <div><strong>{stage.label}</strong><small>{stage.description}</small></div>
              </div>
              {index < ROOM_PROGRESS_STAGES.length - 1 ? <span className="room-lifecycle__line" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
