"use client";

import { useState } from "react";
import type { Theme } from "@/lib/data/contracts";
import { Surface } from "@/components/ui";
import { CreateRoomModal } from "./create-room-modal";

export function CreateRoomLauncher({
  themes,
  initialOpen = false,
}: {
  themes: Theme[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <>
      <button className="create-room-card-button" type="button" onClick={() => setOpen(true)}>
        <Surface className="create-room-card" tone="quiet">
          <div className="create-room-card__plus">+</div>
          <h3>Buat Room Baru</h3>
          <p>Mulai kejutan berikutnya dalam beberapa langkah mudah.</p>
        </Surface>
      </button>

      <CreateRoomModal themes={themes} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
