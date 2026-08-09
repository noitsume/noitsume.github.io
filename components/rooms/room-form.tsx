"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Room, Theme } from "@/lib/data/contracts";
import { Button } from "@/components/ui";
import { getCsrfToken } from "@/lib/auth/client";

const occasionOptions = [
  { value: "birthday", label: "Ulang Tahun" },
  { value: "graduation", label: "Wisuda" },
  { value: "anniversary", label: "Anniversary" },
] as const;

function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

export function RoomForm({
  mode,
  themes,
  room,
}: {
  mode: "create" | "edit";
  themes: Theme[];
  room?: Room;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(room?.title ?? "");
  const [recipientName, setRecipientName] = useState(room?.recipientName ?? "");
  const [occasionId, setOccasionId] = useState(room?.occasionId ?? "birthday");
  const [themeId, setThemeId] = useState(room?.themeId ?? themes[0]?.id ?? "");
  const [deadline, setDeadline] = useState(
    room?.collectionDeadline ? isoToLocalInput(room.collectionDeadline) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === themeId),
    [themeId, themes],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      const payload = {
        title: title.trim(),
        recipientName: recipientName.trim(),
        occasionId,
        eventId: room?.eventId ?? null,
        themeId,
        customThemeNameRaw: room?.customThemeNameRaw ?? null,
        collectionDeadline: localInputToIso(deadline),
        expiresAt: room?.expiresAt ?? null,
      };

      const response = await fetch(
        mode === "create" ? "/api/rooms" : `/api/rooms/${room!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken,
          },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error?.message ?? "Room tidak dapat disimpan.");
      }

      const roomId = result.data.room.id as string;
      router.push(`/rooms/${roomId}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Room tidak dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="room-form" onSubmit={submit}>
      <div className="room-form__grid">
        <label className="form-field room-form__wide">
          <span>Nama Room</span>
          <input
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Contoh: Kejutan Ulang Tahun Naya"
            required
            value={title}
          />
          <small>Nama internal workspace. Bisa kamu ubah kapan saja.</small>
        </label>

        <label className="form-field">
          <span>Yang dirayakan</span>
          <input
            maxLength={80}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Nama penerima"
            required
            value={recipientName}
          />
        </label>

        <label className="form-field">
          <span>Jenis acara</span>
          <select value={occasionId} onChange={(event) => setOccasionId(event.target.value)}>
            {occasionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Tema awal</span>
          <select
            value={themeId}
            onChange={(event) => setThemeId(event.target.value)}
            required
          >
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
          <small>{selectedTheme ? `${selectedTheme.name} · tema pilot` : "Pilih tema"}</small>
        </label>

        <label className="form-field">
          <span>Deadline collecting</span>
          <input
            onChange={(event) => setDeadline(event.target.value)}
            required
            type="datetime-local"
            value={deadline}
          />
          <small>Setelah waktu ini, Collector nanti tidak menerima submission baru.</small>
        </label>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="room-form__actions">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => router.back()}
        >
          Batal
        </Button>
        <Button type="submit" variant="primary" disabled={busy || themes.length === 0}>
          {busy
            ? "Menyimpan..."
            : mode === "create"
              ? "Buat Room"
              : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}
