"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Theme, ThemeAnchor } from "@/lib/data/contracts";

type AnchorDrafts = Record<string, ThemeAnchor[]>;

const STORAGE_KEY = "kenangin:theme-anchor-drafts:v1";
const STORAGE_EVENT = "kenangin:theme-anchor-drafts-changed";

function cloneAnchors(themes: Theme[]): AnchorDrafts {
  return Object.fromEntries(
    themes.map((theme) => [theme.id, theme.anchors.map((anchor) => ({ ...anchor }))]),
  );
}

function backgroundPath(theme: Theme) {
  return theme.assets.background.source === "public"
    ? theme.assets.background.publicPath
    : null;
}

function readStoredDrafts(raw: string | null): AnchorDrafts {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AnchorDrafts;
  } catch {
    // Broken local drafts should never block the dev tool.
    return {};
  }
}

function subscribeToStoredDrafts(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function getStoredDraftSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerDraftSnapshot() {
  return null;
}

export function ThemeAnchorTool({ themes }: { themes: Theme[] }) {
  const [themeId, setThemeId] = useState<string>(themes[0]?.id ?? "");
  const [draftOverrides, setDraftOverrides] = useState<AnchorDrafts>({});
  const [selectedAnchorId, setSelectedAnchorId] = useState(themes[0]?.anchors[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const storedDraftSnapshot = useSyncExternalStore(
    subscribeToStoredDrafts,
    getStoredDraftSnapshot,
    getServerDraftSnapshot,
  );
  const drafts = useMemo(
    () => ({
      ...cloneAnchors(themes),
      ...readStoredDrafts(storedDraftSnapshot),
      ...draftOverrides,
    }),
    [draftOverrides, storedDraftSnapshot, themes],
  );

  const theme = useMemo(
    () => themes.find((candidate) => candidate.id === themeId) ?? themes[0],
    [themeId, themes],
  );
  const anchors = theme ? drafts[theme.id] ?? theme.anchors : [];
  const selectedAnchor = anchors.find((anchor) => anchor.id === selectedAnchorId) ?? anchors[0];

  if (!theme || !selectedAnchor) {
    return <main className="theme-anchor-tool"><p>No curated themes available.</p></main>;
  }

  function updateAnchor(patch: Partial<ThemeAnchor>) {
    setDraftOverrides((current) => ({
      ...current,
      [theme.id]: anchors.map((anchor) =>
        anchor.id === selectedAnchor.id ? { ...anchor, ...patch } : anchor,
      ),
    }));
    setNotice(null);
  }

  function saveDraft() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    window.dispatchEvent(new Event(STORAGE_EVENT));
    setDraftOverrides({});
    setNotice("Draft anchor tersimpan di browser ini.");
  }

  async function copyThemeAnchors() {
    await navigator.clipboard.writeText(JSON.stringify(anchors, null, 2));
    setNotice("JSON anchors disalin. Tempelkan ke config/themes.ts setelah review.");
  }

  function resetTheme() {
    setDraftOverrides((current) => ({
      ...current,
      [theme.id]: theme.anchors.map((anchor) => ({ ...anchor })),
    }));
    setNotice("Theme dikembalikan ke anchor dari catalog.");
  }

  const bgPath = backgroundPath(theme);

  return (
    <main className="theme-anchor-tool">
      <header className="theme-anchor-tool__header">
        <div>
          <p className="ui-eyebrow">PATCH 6 · DEV TOOL</p>
          <h1>Theme Anchor Tool</h1>
          <p>Atur posisi anchor curated theme, simpan draft lokal, lalu salin JSON final ke catalog.</p>
        </div>
        <div className="theme-anchor-tool__actions">
          <button type="button" onClick={resetTheme}>Reset theme</button>
          <button type="button" onClick={saveDraft}>Simpan draft</button>
          <button type="button" className="is-primary" onClick={copyThemeAnchors}>Salin JSON</button>
        </div>
      </header>

      <section className="theme-anchor-tool__layout">
        <aside className="theme-anchor-tool__panel">
          <label>
            <span>Theme</span>
            <select
              value={theme.id}
              onChange={(event) => {
                const nextId = event.target.value;
                setThemeId(nextId);
                const nextTheme = themes.find((candidate) => candidate.id === nextId);
                setSelectedAnchorId(nextTheme?.anchors[0]?.id ?? "");
              }}
            >
              {themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          <label>
            <span>Anchor</span>
            <select value={selectedAnchor.id} onChange={(event) => setSelectedAnchorId(event.target.value)}>
              {anchors.map((anchor) => <option key={anchor.id} value={anchor.id}>{anchor.id}</option>)}
            </select>
          </label>

          <label>
            <span>X · {selectedAnchor.anchorX.toFixed(0)}%</span>
            <input type="range" min="0" max="100" step="1" value={selectedAnchor.anchorX} onChange={(event) => updateAnchor({ anchorX: Number(event.target.value) })} />
          </label>

          <label>
            <span>Y · {selectedAnchor.anchorY.toFixed(0)}%</span>
            <input type="range" min="0" max="100" step="1" value={selectedAnchor.anchorY} onChange={(event) => updateAnchor({ anchorY: Number(event.target.value) })} />
          </label>

          <label>
            <span>Placement</span>
            <select value={selectedAnchor.placement} onChange={(event) => updateAnchor({ placement: event.target.value as ThemeAnchor["placement"] })}>
              <option value="background">background</option>
              <option value="midground">midground</option>
              <option value="foreground">foreground</option>
            </select>
          </label>

          <label>
            <span>Purpose</span>
            <select value={selectedAnchor.purpose} onChange={(event) => updateAnchor({ purpose: event.target.value as ThemeAnchor["purpose"] })}>
              <option value="ornament">ornament</option>
              <option value="media-safe-zone">media-safe-zone</option>
              <option value="copy-safe-zone">copy-safe-zone</option>
            </select>
          </label>

          {notice ? <p className="theme-anchor-tool__notice">{notice}</p> : null}
        </aside>

        <div className="theme-anchor-tool__preview" style={{ backgroundColor: theme.palette.background, backgroundImage: bgPath ? `url(${bgPath})` : undefined }}>
          {anchors.map((anchor) => (
            <button
              key={anchor.id}
              type="button"
              className={`theme-anchor-tool__marker${anchor.id === selectedAnchor.id ? " is-active" : ""}`}
              style={{ left: `${anchor.anchorX}%`, top: `${anchor.anchorY}%` }}
              title={`${anchor.id} · ${anchor.purpose}`}
              onClick={() => setSelectedAnchorId(anchor.id)}
            >
              <span>{anchor.id}</span>
            </button>
          ))}
          <div className="theme-anchor-tool__sample-copy" style={{ color: theme.palette.text, fontFamily: theme.typography.displayFamily }}>
            <small style={{ color: theme.palette.accent }}>{theme.themePersonality.join(" · ")}</small>
            <strong>{theme.name}</strong>
            <p style={{ color: theme.palette.muted }}>{theme.description}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
