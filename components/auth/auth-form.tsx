"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Button } from "@/components/ui";
import { createServerSession } from "@/lib/auth/client";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

function authErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
  }

  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email atau password tidak cocok.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan login.",
    "auth/invalid-email": "Format email belum benar.",
    "auth/weak-password": "Password terlalu lemah. Gunakan minimal 6 karakter.",
    "auth/popup-closed-by-user": "Login Google dibatalkan.",
    "auth/popup-blocked": "Popup Google diblokir browser. Izinkan popup lalu coba lagi.",
    "auth/network-request-failed": "Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
  };

  return messages[error.code] ?? "Autentikasi gagal. Coba lagi.";
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function AuthForm({
  mode,
  nextPath = "/dashboard",
}: {
  mode: "login" | "register";
  nextPath?: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(user: Parameters<typeof createServerSession>[0]) {
    await createServerSession(user);
    router.replace(safeNextPath(nextPath));
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const auth = getFirebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);

      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanName = displayName.trim();
        if (cleanName) {
          await updateProfile(credential.user, { displayName: cleanName });
        }
        await finish(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        await finish(credential.user);
      }
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);

    try {
      const auth = getFirebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      await finish(credential.user);
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="auth-card__heading">
        <p className="ui-eyebrow">OWNER ACCESS</p>
        <h2>{mode === "login" ? "Masuk ke workspace" : "Buat akun owner"}</h2>
        <p>
          {mode === "login"
            ? "Lanjutkan Room yang sedang kamu siapkan."
            : "Satu akun untuk mengelola semua Room dan kejutanmu."}
        </p>
      </div>

      <button className="auth-google-button" type="button" onClick={onGoogle} disabled={busy}>
        <span className="auth-google-button__mark" aria-hidden="true">G</span>
        <span>Lanjut dengan Google</span>
      </button>

      <div className="auth-divider"><span>atau dengan email</span></div>

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "register" ? (
          <label className="form-field">
            <span>Nama</span>
            <input
              autoComplete="name"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Nama yang tampil di Kenangin"
              required
              value={displayName}
            />
          </label>
        ) : null}

        <label className="form-field">
          <span>Email</span>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@email.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="form-field">
          <span>Password</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimal 6 karakter"
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <Button className="auth-submit" disabled={busy} type="submit" variant="primary">
          {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Buat akun"}
        </Button>
      </form>
    </>
  );
}
