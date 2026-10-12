"use client";

import { useState, type FormEvent } from "react";
import { ownerDestination } from "@/lib/auth/destination";
import { AuthToDeskTransition } from "@/components/auth/auth-to-desk-transition";
import { AUTH_EXIT_MS, prepareDeskArrival } from "@/lib/dashboard/arrival";
import { preloadDeskScene } from "@/lib/dashboard/preload";
import { Button } from "@/components/ui";
import { saveOwnerUsername } from "@/lib/auth/client";

export function UsernameOnboarding({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || transitioning) return;

    const cleanUsername = username.replace(/\s+/g, " ").trim();
    if (cleanUsername.length < 2) {
      setError("Nama pengguna minimal 2 karakter.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      preloadDeskScene(ownerDestination(nextPath));
      await saveOwnerUsername(cleanUsername);

      const destination = ownerDestination(nextPath);
      prepareDeskArrival(destination);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTransitioning(true);
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, reducedMotion ? 0 : AUTH_EXIT_MS),
      );

      window.location.replace(destination);
    } catch (submitError) {
      setTransitioning(false);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nama pengguna belum dapat disimpan. Coba lagi.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <AuthToDeskTransition active={transitioning} />
      <div className="auth-card__heading auth-card__heading--onboarding">
        <p className="ui-eyebrow">SATU LANGKAH TERAKHIR</p>
        <h2>Kamu mau dipanggil apa?</h2>
        <p>
          Nama ini yang akan Kenangin.id simpan dan tampilkan di workspace—bukan nama dari akun Google.
        </p>
      </div>

      <form className="auth-form auth-form--onboarding" onSubmit={onSubmit}>
        <label className="form-field">
          <span>Nama pengguna</span>
          <input
            autoComplete="nickname"
            autoFocus
            disabled={busy || transitioning}
            maxLength={32}
            minLength={2}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="contoh: Kevin"
            required
            value={username}
          />
          <small className="form-field__hint">2–32 karakter. Bisa kamu ubah lagi nanti.</small>
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <Button className="auth-submit" disabled={busy || transitioning} type="submit" variant="primary">
          {transitioning ? "Menyiapkan meja..." : busy ? "Menyimpan..." : "Masuk ke workspace"}
        </Button>
      </form>
    </>
  );
}
