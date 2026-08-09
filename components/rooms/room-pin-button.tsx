"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinIcon } from "@/components/ui";
import { getCsrfToken } from "@/lib/auth/client";

export function RoomPinButton({ roomId, pinned }: { roomId: string; pinned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${roomId}/pin`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({ pinned: !pinned }),
      });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="pinned-room-card__pin"
      type="button"
      aria-label={pinned ? "Lepas sematan Room" : "Sematkan Room"}
      disabled={busy}
      onClick={toggle}
    >
      <PinIcon size={14} />
    </button>
  );
}
