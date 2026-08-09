"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { getCsrfToken } from "@/lib/auth/client";

export function RoomActions({ roomId, pinned }: { roomId: string; pinned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"pin" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function togglePin() {
    setBusy("pin");
    setError(null);
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
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Pin Room gagal diubah.");
      }
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Aksi gagal.");
    } finally {
      setBusy(null);
    }
  }

  async function removeRoom() {
    if (!window.confirm("Hapus Room ini? Tindakan ini belum dapat dibatalkan.")) return;

    setBusy("delete");
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Room gagal dihapus.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Aksi gagal.");
      setBusy(null);
    }
  }

  return (
    <div className="room-actions">
      <Button variant="secondary" onClick={togglePin} disabled={busy !== null}>
        {busy === "pin" ? "Menyimpan..." : pinned ? "Lepas Pin" : "Pin Room"}
      </Button>
      <Button className="room-actions__danger" variant="ghost" onClick={removeRoom} disabled={busy !== null}>
        {busy === "delete" ? "Menghapus..." : "Hapus Room"}
      </Button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
