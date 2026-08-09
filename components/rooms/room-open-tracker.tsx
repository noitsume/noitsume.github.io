"use client";

import { useEffect } from "react";
import { getCsrfToken } from "@/lib/auth/client";

export function RoomOpenTracker({ roomId }: { roomId: string }) {
  useEffect(() => {
    let cancelled = false;

    async function track() {
      try {
        const csrfToken = await getCsrfToken();
        if (cancelled) return;
        await fetch(`/api/rooms/${roomId}/open`, {
          method: "POST",
          headers: { "x-csrf-token": csrfToken },
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        // Recent-room tracking must never block the workspace.
      }
    }

    void track();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return null;
}
