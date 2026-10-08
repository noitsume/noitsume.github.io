"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Room, Theme } from "@/lib/data/contracts";
import { Button, SelectPopover, type SelectOption } from "@/components/ui";
import { getCsrfToken } from "@/lib/auth/client";

const occasionOptions = [
  { value: "birthday", label: "Ulang Tahun", description: "Untuk perayaan ulang tahun personal" },
  { value: "graduation", label: "Wisuda", description: "Ucapan kelulusan dan pencapaian" },
  { value: "anniversary", label: "Anniversary", description: "Momen perayaan hubungan dan kebersamaan" },
] as const satisfies readonly SelectOption[];

function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Pilih tanggal dan jam batas pengumpulan, atau gunakan pilihan cepat di bawahnya.");
  return date.toISOString();
}

export function RoomForm({
  mode,
  themes,
  room,
  onCancel,
  onBusyChange,
}: {
  mode: "create" | "edit";
  themes: Theme[];
  room?: Room;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
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

  const themeOptions = useMemo<SelectOption[]>(
    () => themes.map((theme) => ({ value: theme.id, label: theme.name, description: theme.description })),
    [themes],
  );

  function handleCancel() {
    if (busy) return;
    if (onCancel) onCancel();
    else router.push(room ? `/rooms/${room.id}` : "/dashboard");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    onBusyChange?.(true);
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
      onBusyChange?.(false);
    }
  }

  return (
    <form className="room-form" onSubmit={submit}>
      <fieldset className="room-form__grid" disabled={busy}>
        <label className="form-field room-form__wide">
          <span>Nama Room</span>
          <input
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Contoh: Kejutan Ulang Tahun Naya"
            required
            value={title}
          />
          <small>Nama untuk memudahkan kamu menemukan kenangan ini nanti.</small>
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

        <div className="form-field">
          <span>Jenis acara</span>
          <SelectPopover
            ariaLabel="Jenis acara"
            options={occasionOptions}
            value={occasionId}
            onChange={setOccasionId}
          />
        </div>

        <div className="form-field">
          <span>Tema awal</span>
          <SelectPopover
            ariaLabel="Tema awal"
            options={themeOptions}
            value={themeId}
            onChange={setThemeId}
            disabled={themes.length === 0}
            placeholder="Pilih tema"
          />
          <small>{selectedTheme?.description ?? "Pilih tema"}</small>
        </div>

        <div className="form-field">
          <label htmlFor="room-deadline">Batas pengumpulan</label>
          <input id="room-deadline"
            onChange={(event) => setDeadline(event.target.value)}
            required
            type="datetime-local"
            value={deadline}
          />
          <small>Waktu lokal perangkatmu. Kiriman baru ditutup setelah batas ini.</small>
          <div className="deadline-shortcuts">{[1, 3, 7].map(days => <button className="ui-button ui-button--ghost" type="button" key={days} onClick={() => { setDeadline(isoToLocalInput(new Date(Date.now() + days * 86400000).toISOString())); setError(null); }}>{days === 1 ? "Besok" : days + " hari lagi"}</button>)}</div>
        </div>
      </fieldset>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="room-form__actions">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={handleCancel}
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
