"use client";

import { useEffect } from "react";
import { getCsrfToken } from "@/lib/auth/client";

const CLIENT_TRACK_THROTTLE_MS = 60 * 60 * 1000;

function storageKey(roomId: string) {
  return `kenangin:room-open:${roomId}`;
}

export function RoomOpenTracker({ roomId }: { roomId: string }) {
  useEffect(() => {
    const key = storageKey(roomId);
    const now = Date.now();

    try {
      const previous = Number(window.localStorage.getItem(key) ?? 0);
      if (Number.isFinite(previous) && now - previous < CLIENT_TRACK_THROTTLE_MS) {
        return;
      }
      // Reserve immediately so React remounts / multiple renders do not create
      // duplicate in-flight POST requests.
      window.localStorage.setItem(key, String(now));
    } catch {
      // localStorage is an optimization only. The server also throttles writes.
    }

    async function track() {
      try {
        const csrfToken = await getCsrfToken();
        const response = await fetch(`/api/rooms/${roomId}/open`, {
          method: "POST",
          headers: { "x-csrf-token": csrfToken },
          credentials: "same-origin",
          keepalive: true,
        });

        if (!response.ok) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // Ignore storage failures.
          }
        }
      } catch {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Ignore storage failures.
        }
        // Recent-room tracking must never block the workspace.
      }
    }

    void track();
  }, [roomId]);

  return null;
}
