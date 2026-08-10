"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { curatedSongs } from "@/config/songs";
import { curatedThemes } from "@/config/themes";
import { getCsrfToken } from "@/lib/auth/client";
import type { BackgroundMusicSelection, RoomMusic, ThemeId } from "@/lib/creative";
import type { Media } from "@/lib/data/contracts";
import { preprocessMediaFile } from "@/lib/media-intelligence/client-preprocess";
import {
  analyzeRoomMusicFile,
} from "@/lib/studio/music-client";
import type {
  ExperienceDNA,
  RoomStudioConfig,
  StoryAnchors,
  StudioMediaSetting,
} from "@/lib/studio/contracts";
import {
  CheckIcon,
  PhotoIcon,
  Surface,
  UploadIcon,
  VideoIcon,
} from "@/components/ui";

type StudioStep = "media" | "anchors" | "music" | "direction";
type BusyAction = "save-media" | "save-anchors" | "upload-music" | "analyze-music" | "save-music" | "generate" | "select-direction" | null;

const EMPTY_ANCHORS: StoryAnchors = { opening: [], climax: [], ending: [] };

function initialStep(studio: RoomStudioConfig): StudioStep {
  if (studio.selectedMedia.length === 0) return "media";
  if (!studio.storyAnchorsConfirmed) return "anchors";
  if (!studio.backgroundMusic) return "music";
  return "direction";
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function defaultMediaSetting(item: Media, order: number): StudioMediaSetting {
  return {
    mediaId: item.id,
    order,
    volume: item.type === "video" ? 1 : 0,
    trimInSec: null,
    trimOutSec: null,
    loop: false,
    fit: "cover",
  };
}

function cleanAnchors(anchors: StoryAnchors, selected: StudioMediaSetting[]) {
  const ids = new Set(selected.map((item) => item.mediaId));
  return {
    opening: anchors.opening.filter((id) => ids.has(id)),
    climax: anchors.climax.filter((id) => ids.has(id)),
    ending: anchors.ending.filter((id) => ids.has(id)),
  } satisfies StoryAnchors;
}

function selectedDirection(studio: RoomStudioConfig) {
  return studio.directionCandidates.find((item) => item.id === studio.selectedDirectionId) ?? null;
}

export function SettingsStudio({
  roomId,
  recipientName,
  media: initialMedia,
  previewUrlByMediaId: initialPreviewUrlByMediaId,
  initialStudio,
  initialRoomMusic,
}: {
  roomId: string;
  recipientName: string;
  media: Media[];
  previewUrlByMediaId: Record<string, string>;
  initialStudio: RoomStudioConfig;
  initialRoomMusic: RoomMusic[];
}) {
  const router = useRouter();
  const musicInputRef = useRef<HTMLInputElement | null>(null);
  const [studio, setStudio] = useState(initialStudio);
  const [media, setMedia] = useState(initialMedia);
  const [previewUrlByMediaId, setPreviewUrlByMediaId] = useState(initialPreviewUrlByMediaId);
  const [roomMusic, setRoomMusic] = useState(initialRoomMusic);
  const [selectedMedia, setSelectedMedia] = useState<StudioMediaSetting[]>(initialStudio.selectedMedia);
  const [anchors, setAnchors] = useState<StoryAnchors>(initialStudio.storyAnchors ?? EMPTY_ANCHORS);
  const [themeId, setThemeId] = useState<ThemeId>(initialStudio.themeId);
  const [backgroundMusic, setBackgroundMusic] = useState<BackgroundMusicSelection | null>(initialStudio.backgroundMusic);
  const [activeStep, setActiveStep] = useState<StudioStep>(initialStep(initialStudio));
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [deepAnalysisNote, setDeepAnalysisNote] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selectedMedia.map((item) => item.mediaId)), [selectedMedia]);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const selectedItems = useMemo(
    () => [...selectedMedia].sort((a, b) => a.order - b.order).map((setting) => ({ setting, media: mediaById.get(setting.mediaId) })).filter((item): item is { setting: StudioMediaSetting; media: Media } => Boolean(item.media)),
    [mediaById, selectedMedia],
  );
  const selectedPhotoCount = selectedItems.filter((item) => item.media.type === "photo").length;
  const selectedVideoCount = selectedItems.filter((item) => item.media.type === "video").length;
  const compatibleSongs = curatedSongs.filter((song) => song.compatibleThemes.includes(themeId));
  const currentDirection = selectedDirection(studio);
  const mediaStepPersisted = useMemo(
    () => themeId === studio.themeId && JSON.stringify(selectedMedia) === JSON.stringify(studio.selectedMedia),
    [selectedMedia, studio.selectedMedia, studio.themeId, themeId],
  );
  const anchorsStepPersisted = useMemo(
    () => studio.storyAnchorsConfirmed && JSON.stringify(anchors) === JSON.stringify(studio.storyAnchors),
    [anchors, studio.storyAnchors, studio.storyAnchorsConfirmed],
  );
  const musicStepPersisted = useMemo(
    () => Boolean(studio.backgroundMusic) && JSON.stringify(backgroundMusic) === JSON.stringify(studio.backgroundMusic),
    [backgroundMusic, studio.backgroundMusic],
  );

  function clearFeedback() {
    setError(null);
    setNotice(null);
  }

  function toggleMedia(item: Media) {
    clearFeedback();
    if (selectedIds.has(item.id)) {
      const next = selectedMedia
        .filter((setting) => setting.mediaId !== item.id)
        .sort((a, b) => a.order - b.order)
        .map((setting, order) => ({ ...setting, order }));
      setSelectedMedia(next);
      setAnchors((current) => cleanAnchors(current, next));
      return;
    }
    setSelectedMedia((current) => [...current, defaultMediaSetting(item, current.length)]);
  }

  function updateMediaSetting(mediaId: string, patch: Partial<StudioMediaSetting>) {
    setSelectedMedia((current) => current.map((item) => item.mediaId === mediaId ? { ...item, ...patch } : item));
  }

  function moveMedia(mediaId: string, direction: -1 | 1) {
    setSelectedMedia((current) => {
      const ordered = [...current].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((item) => item.mediaId === mediaId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return current;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered.map((item, order) => ({ ...item, order }));
    });
  }

  function changeTheme(nextThemeId: ThemeId) {
    setThemeId(nextThemeId);
    if (backgroundMusic?.source === "catalog") {
      const song = curatedSongs.find((item) => item.id === backgroundMusic.songId);
      if (!song?.compatibleThemes.includes(nextThemeId)) setBackgroundMusic(null);
    }
  }

  async function persistSettings(input: {
    storyAnchorsConfirmed: boolean;
    nextBackgroundMusic?: BackgroundMusicSelection | null;
    nextAnchors?: StoryAnchors;
  }) {
    const nextAnchors = cleanAnchors(input.nextAnchors ?? anchors, selectedMedia);
    const nextBackgroundMusic = input.nextBackgroundMusic === undefined ? backgroundMusic : input.nextBackgroundMusic;
    const csrfToken = await getCsrfToken();
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/studio/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      credentials: "same-origin",
      body: JSON.stringify({
        selectedMedia,
        storyAnchors: nextAnchors,
        storyAnchorsConfirmed: input.storyAnchorsConfirmed,
        themeId,
        backgroundMusic: nextBackgroundMusic,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Settings Studio belum berhasil disimpan.");
    const nextStudio = payload.data.studio as RoomStudioConfig;
    setStudio(nextStudio);
    setAnchors(nextStudio.storyAnchors);
    setBackgroundMusic(nextStudio.backgroundMusic);
    return nextStudio;
  }

  async function saveMediaStep() {
    if (busy || selectedMedia.length === 0) return;
    clearFeedback();
    setBusy("save-media");
    try {
      const next = await persistSettings({ storyAnchorsConfirmed: false, nextAnchors: cleanAnchors(anchors, selectedMedia) });
      setStudio(next);
      setActiveStep("anchors");
      setNotice(`${selectedMedia.length} media dipilih: ${selectedVideoCount} video section${selectedPhotoCount > 0 ? ` + 1 photo-slide (${selectedPhotoCount} foto)` : ""}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Pilihan media belum tersimpan.");
    } finally {
      setBusy(null);
    }
  }

  function toggleAnchor(role: keyof StoryAnchors, mediaId: string) {
    setAnchors((current) => {
      const exists = current[role].includes(mediaId);
      return { ...current, [role]: exists ? current[role].filter((id) => id !== mediaId) : [...current[role], mediaId] };
    });
  }

  async function saveAnchorStep(skip = false) {
    if (busy) return;
    clearFeedback();
    setBusy("save-anchors");
    const nextAnchors = skip ? EMPTY_ANCHORS : anchors;
    try {
      const next = await persistSettings({ storyAnchorsConfirmed: true, nextAnchors });
      setAnchors(next.storyAnchors);
      setActiveStep("music");
      setNotice(skip ? "Story Anchors dilewati. Gemini akan menentukan arc dari Media Intelligence." : "Story Anchors tersimpan sebagai guidance untuk Gemini.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Story Anchors belum tersimpan.");
    } finally {
      setBusy(null);
    }
  }

  function selectCatalogSong(songId: (typeof curatedSongs)[number]["id"]) {
    clearFeedback();
    setBackgroundMusic({ source: "catalog", songId });
  }

  async function uploadMusic() {
    if (!musicFile || busy) return;
    clearFeedback();
    if (!musicFile.name.toLowerCase().endsWith(".mp3")) {
      setError("Upload background music harus file MP3.");
      return;
    }
    if (musicFile.size > 30 * 1024 * 1024) {
      setError("MP3 maksimal 30 MB.");
      return;
    }

    setBusy("upload-music");
    try {
      const csrfToken = await getCsrfToken();
      const requestResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/music/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({
          name: musicFile.name.replace(/\.mp3$/i, "").trim() || "Background Music",
          fileName: musicFile.name,
          contentType: "audio/mpeg",
          sizeBytes: musicFile.size,
        }),
      });
      const requestPayload = await requestResponse.json();
      if (!requestResponse.ok || !requestPayload?.ok) throw new Error(requestPayload?.error?.message ?? "Upload URL lagu belum siap.");
      const prepared = requestPayload.data as { musicId: string; objectKey: string; uploadUrl: string; name: string };

      const uploadResponse = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "audio/mpeg" },
        body: musicFile,
      });
      if (!uploadResponse.ok) throw new Error("Upload MP3 ke storage gagal.");

      const commitResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/music/commit`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({
          musicId: prepared.musicId,
          name: prepared.name,
          fileName: musicFile.name,
          contentType: "audio/mpeg",
          sizeBytes: musicFile.size,
          objectKey: prepared.objectKey,
        }),
      });
      const commitPayload = await commitResponse.json();
      if (!commitResponse.ok || !commitPayload?.ok) throw new Error(commitPayload?.error?.message ?? "Metadata lagu belum tersimpan.");
      const uploaded = commitPayload.data.music as RoomMusic;
      setRoomMusic((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
      setMusicFile(null);
      if (musicInputRef.current) musicInputRef.current.value = "";
      setNotice("MP3 sudah diupload. Klik Analyze untuk memetakan BPM, beats, onset, energy curve, dan section lagu.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload lagu gagal.");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeMusic(item: RoomMusic) {
    if (busy) return;
    clearFeedback();
    setBusy("analyze-music");
    try {
      const urlResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/music/${encodeURIComponent(item.id)}/download-url`, { credentials: "same-origin" });
      const urlPayload = await urlResponse.json();
      if (!urlResponse.ok || !urlPayload?.ok) throw new Error(urlPayload?.error?.message ?? "File lagu belum dapat dibaca.");
      const fileResponse = await fetch(urlPayload.data.url);
      if (!fileResponse.ok) throw new Error("MP3 tidak dapat dibaca dari private storage.");
      const blob = await fileResponse.blob();
      const file = new File([blob], item.originalFileName, { type: "audio/mpeg" });
      const analysis = await analyzeRoomMusicFile(file);
      const csrfToken = await getCsrfToken();
      const analyzeResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/music/${encodeURIComponent(item.id)}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify(analysis),
      });
      const payload = await analyzeResponse.json();
      if (!analyzeResponse.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Beatmap lagu belum tersimpan.");
      const updated = payload.data.music as RoomMusic;
      setRoomMusic((current) => current.map((music) => music.id === updated.id ? updated : music));
      setBackgroundMusic({ source: "room-upload", musicId: updated.id });
      setNotice(`Analyze selesai: ${Math.round(updated.analysis.bpm ?? 0)} BPM · ${updated.analysis.beats.length} beats · ${formatDuration(updated.analysis.durationSec)}.`);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analisis lagu gagal. File tetap aman dan bisa dicoba lagi.");
    } finally {
      setBusy(null);
    }
  }

  async function saveMusicStep() {
    if (!backgroundMusic || busy) return;
    clearFeedback();
    if (backgroundMusic.source === "room-upload") {
      const music = roomMusic.find((item) => item.id === backgroundMusic.musicId);
      if (music?.analysis.status !== "ready") {
        setError("Klik Analyze sampai beatmap lagu berstatus Ready sebelum melanjutkan.");
        return;
      }
    }
    setBusy("save-music");
    try {
      const next = await persistSettings({ storyAnchorsConfirmed: true, nextBackgroundMusic: backgroundMusic });
      setStudio(next);
      setActiveStep("direction");
      setNotice("Background music dikunci untuk direction. Timeline musik akan continuous pada Receiver.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Background music belum tersimpan.");
    } finally {
      setBusy(null);
    }
  }

  async function resolvePreviewUrl(item: Media) {
    const existing = previewUrlByMediaId[item.id];
    if (existing) return existing;
    const csrfToken = await getCsrfToken();
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/preview-urls`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      credentials: "same-origin",
      body: JSON.stringify({ media: [{ id: item.id, objectKey: item.storageObjectKey }] }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) throw new Error("Private preview media tidak tersedia.");
    const url = payload.data.previewUrlByMediaId?.[item.id] as string | undefined;
    if (!url) throw new Error("Private preview media tidak tersedia.");
    setPreviewUrlByMediaId((current) => ({ ...current, [item.id]: url }));
    return url;
  }

  async function deepenAnchorsBestEffort() {
    const anchorIds = Array.from(new Set([...anchors.opening, ...anchors.climax, ...anchors.ending]));
    const candidates = anchorIds
      .map((id) => mediaById.get(id))
      .filter((item): item is Media => Boolean(item && (item.analysisStatus !== "ready" || item.needsDeepAnalysis)));
    if (candidates.length === 0) return;

    let completed = 0;
    for (const item of candidates) {
      setDeepAnalysisNote(`Deep Analysis Story Anchor ${completed + 1}/${candidates.length}: ${item.originalFileName}`);
      try {
        const url = await resolvePreviewUrl(item);
        const originalResponse = await fetch(url);
        if (!originalResponse.ok) throw new Error("original unavailable");
        const blob = await originalResponse.blob();
        const file = new File([blob], item.originalFileName, { type: item.contentType });
        const analysis = await preprocessMediaFile(file, "deep");
        const csrfToken = await getCsrfToken();
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/analyze`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          credentials: "same-origin",
          body: JSON.stringify({ mediaId: item.id, analysis }),
        });
        const payload = await response.json();
        if (response.ok && payload?.ok && payload.data.media) {
          const updated = payload.data.media as Media;
          setMedia((current) => current.map((mediaItem) => mediaItem.id === updated.id ? updated : mediaItem));
        }
      } catch {
        // Deep Analysis is a quality upgrade, not a generation dependency.
      }
      completed += 1;
    }
    setDeepAnalysisNote(null);
  }

  async function generateDirections() {
    if (busy || !studio.backgroundMusic) return;
    clearFeedback();
    setBusy("generate");
    try {
      await deepenAnchorsBestEffort();
      setDeepAnalysisNote("Gemini Experience Director sedang menyusun 3 direction. Fallback baru dipakai setelah batas tunggu Director.");
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/studio/generate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ variantCount: 3 }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Experience Director gagal menyusun direction.");
      const next = payload.data.studio as RoomStudioConfig;
      setStudio(next);
      const mode = next.directionCandidates[0]?.generationMode;
      setNotice(mode === "fallback"
        ? "Gemini tidak selesai dalam gate-nya. Direction deterministic fallback dibuat dengan seluruh media pilihan."
        : `${next.directionCandidates.length} direction Gemini siap dibandingkan.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Direction belum berhasil dibuat.");
    } finally {
      setDeepAnalysisNote(null);
      setBusy(null);
    }
  }

  async function chooseDirection(directionId: string) {
    if (busy) return;
    clearFeedback();
    setBusy("select-direction");
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/studio/select-direction`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ directionId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Direction belum dapat dipilih.");
      const next = payload.data.studio as RoomStudioConfig;
      setStudio(next);
      setNotice("Direction dikunci. Room sudah memenuhi gate untuk masuk Bake pada Patch 8.");
      router.refresh();
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Direction belum dapat dipilih.");
    } finally {
      setBusy(null);
    }
  }

  const stepState = {
    media: mediaStepPersisted && studio.selectedMedia.length > 0 ? "done" : "active",
    anchors: !mediaStepPersisted || studio.selectedMedia.length === 0 ? "locked" : anchorsStepPersisted ? "done" : "active",
    music: !anchorsStepPersisted ? "locked" : musicStepPersisted ? "done" : "active",
    direction: !musicStepPersisted ? "locked" : studio.selectedDirectionId ? "done" : "active",
  } as const;

  return (
    <div className="settings-studio">
      <Surface className="studio-stepper" tone="quiet">
        {(["media", "anchors", "music", "direction"] as StudioStep[]).map((step, index) => {
          const labels = {
            media: ["Media", "Pilih section"],
            anchors: ["Story Anchors", "Optional guidance"],
            music: ["Music", "Template / MP3"],
            direction: ["Direction", "Gemini + preview"],
          } as const;
          const locked = stepState[step] === "locked";
          return (
            <button
              className={`studio-step studio-step--${stepState[step]} ${activeStep === step ? "is-current" : ""}`}
              disabled={locked || busy !== null}
              key={step}
              onClick={() => setActiveStep(step)}
              type="button"
            >
              <span>{stepState[step] === "done" ? "✓" : index + 1}</span>
              <div><strong>{labels[step][0]}</strong><small>{labels[step][1]}</small></div>
            </button>
          );
        })}
      </Surface>

      {error ? <p className="studio-feedback studio-feedback--error" role="alert">{error}</p> : null}
      {notice ? <p className="studio-feedback studio-feedback--success" role="status"><CheckIcon size={14} />{notice}</p> : null}
      {deepAnalysisNote ? <p className="studio-feedback studio-feedback--working" role="status">{deepAnalysisNote}</p> : null}

      {activeStep === "media" ? (
        <div className="studio-layout">
          <main className="studio-main">
            <Surface className="studio-panel" tone="quiet">
              <div className="studio-panel__heading">
                <div><p className="ui-eyebrow">STEP 1 · MEDIA</p><h2>Pilih media yang benar-benar masuk</h2><p>Video menjadi section sendiri. Semua foto pilihan digabung menjadi satu photo-slide section agar experience tidak terlalu panjang.</p></div>
                <strong>{selectedMedia.length}/{media.length}</strong>
              </div>
              <div className="studio-media-grid">
                {media.map((item) => {
                  const selected = selectedIds.has(item.id);
                  const url = previewUrlByMediaId[item.id];
                  return (
                    <button className={`studio-media-choice ${selected ? "is-selected" : ""}`} key={item.id} onClick={() => toggleMedia(item)} type="button">
                      <div className="studio-media-choice__preview">
                        {url ? item.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={item.originalFileName} src={url} />
                        ) : <video muted playsInline preload="metadata" src={url} /> : <span>{item.type === "photo" ? <PhotoIcon size={22} /> : <VideoIcon size={22} />}</span>}
                        <i>{selected ? "✓" : "+"}</i>
                      </div>
                      <div><strong>{item.originalFileName}</strong><span>{item.type === "video" ? `Video · ${formatDuration(item.durationSec ?? item.technicalSignals?.durationSec)}` : "Foto · masuk photo-slide"}</span></div>
                    </button>
                  );
                })}
              </div>
            </Surface>

            {selectedItems.length > 0 ? (
              <Surface className="studio-panel" tone="quiet">
                <div className="studio-panel__heading"><div><p className="ui-eyebrow">MEDIA SETTINGS</p><h2>Tuning sebelum Gemini</h2><p>Volume adalah volume foreground media. Saat video bersuara aktif, background music akan di-duck otomatis di Receiver.</p></div></div>
                <div className="studio-selected-list">
                  {selectedItems.map(({ setting, media: item }, index) => (
                    <article className="studio-selected-media" key={item.id}>
                      <div className="studio-selected-media__order"><strong>{index + 1}</strong><div><button disabled={index === 0} onClick={() => moveMedia(item.id, -1)} type="button">↑</button><button disabled={index === selectedItems.length - 1} onClick={() => moveMedia(item.id, 1)} type="button">↓</button></div></div>
                      <div className="studio-selected-media__identity"><span>{item.type === "video" ? <VideoIcon size={15} /> : <PhotoIcon size={15} />}</span><div><strong>{item.originalFileName}</strong><small>{item.type === "video" ? "1 video section" : "Photo-slide member"}</small></div></div>
                      <label className="studio-control"><span>Fit</span><select value={setting.fit} onChange={(event) => updateMediaSetting(item.id, { fit: event.target.value as "cover" | "contain" })}><option value="cover">Cover</option><option value="contain">Contain</option></select></label>
                      {item.type === "video" ? (
                        <>
                          <label className="studio-control studio-control--volume"><span>Volume media <b>{Math.round(setting.volume * 100)}%</b></span><input max="1" min="0" onChange={(event) => updateMediaSetting(item.id, { volume: Number(event.target.value) })} step="0.05" type="range" value={setting.volume} /></label>
                          <label className="studio-control"><span>Trim in</span><input min="0" onChange={(event) => updateMediaSetting(item.id, { trimInSec: event.target.value ? Number(event.target.value) : null })} placeholder="0" step="0.1" type="number" value={setting.trimInSec ?? ""} /></label>
                          <label className="studio-control"><span>Trim out</span><input min="0" onChange={(event) => updateMediaSetting(item.id, { trimOutSec: event.target.value ? Number(event.target.value) : null })} placeholder={formatDuration(item.durationSec ?? item.technicalSignals?.durationSec)} step="0.1" type="number" value={setting.trimOutSec ?? ""} /></label>
                          <label className="studio-check"><input checked={setting.loop} onChange={(event) => updateMediaSetting(item.id, { loop: event.target.checked })} type="checkbox" /><span>Loop bila section lebih lama</span></label>
                        </>
                      ) : <span className="studio-photo-audio-note">Foto tidak punya foreground audio · music tetap full</span>}
                    </article>
                  ))}
                </div>
              </Surface>
            ) : null}
          </main>

          <aside className="studio-side">
            <Surface className="studio-summary-card" tone="quiet">
              <p className="ui-eyebrow">SECTION PLAN</p>
              <div><strong>{selectedVideoCount}</strong><span>Video sections</span></div>
              <div><strong>{selectedPhotoCount > 0 ? 1 : 0}</strong><span>Photo-slide section</span></div>
              <div><strong>{selectedMedia.length > 0 ? 1 + selectedVideoCount + (selectedPhotoCount > 0 ? 1 : 0) : 0}</strong><span>Total termasuk Hero</span></div>
            </Surface>
            <Surface className="studio-summary-card" tone="quiet">
              <p className="ui-eyebrow">THEME</p>
              <label className="studio-control"><span>Theme global</span><select onChange={(event) => changeTheme(event.target.value as ThemeId)} value={themeId}>{curatedThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
              <p>{curatedThemes.find((theme) => theme.id === themeId)?.description}</p>
            </Surface>
            <button className="ui-button ui-button--primary studio-continue" disabled={selectedMedia.length === 0 || busy !== null} onClick={saveMediaStep} type="button">{busy === "save-media" ? "Menyimpan..." : "Lanjut ke Story Anchors"}</button>
          </aside>
        </div>
      ) : null}

      {activeStep === "anchors" ? (
        <Surface className="studio-panel studio-anchor-panel" tone="quiet">
          <div className="studio-panel__heading"><div><p className="ui-eyebrow">STEP 2 · STORY ANCHORS</p><h2>Beri Gemini petunjuk momen penting</h2><p>Optional. Pilih lebih dari satu bila perlu. Media anchor yang analisisnya masih ambigu akan dicoba Deep Analysis sebelum Experience Director berjalan.</p></div></div>
          <div className="studio-anchor-groups">
            {(["opening", "climax", "ending"] as const).map((role) => {
              const copy = {
                opening: ["Opening", "Media mana yang cocok membuka cerita?"],
                climax: ["Climax", "Momen mana yang paling penting atau berkesan?"],
                ending: ["Ending", "Media mana yang ingin ditinggalkan sebagai kesan terakhir?"],
              } as const;
              return (
                <section className="studio-anchor-group" key={role}>
                  <div><strong>{copy[role][0]}</strong><span>{copy[role][1]}</span><small>{anchors[role].length} dipilih</small></div>
                  <div className="studio-anchor-media-list">
                    {selectedItems.map(({ media: item }) => (
                      <button className={anchors[role].includes(item.id) ? "is-selected" : ""} key={item.id} onClick={() => toggleAnchor(role, item.id)} type="button">
                        <span>{item.type === "video" ? <VideoIcon size={14} /> : <PhotoIcon size={14} />}</span><strong>{item.originalFileName}</strong><i>{anchors[role].includes(item.id) ? "✓" : "+"}</i>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="studio-panel__actions"><button className="ui-button ui-button--ghost" disabled={busy !== null} onClick={() => saveAnchorStep(true)} type="button">Lanjut tanpa anchor</button><button className="ui-button ui-button--primary" disabled={busy !== null} onClick={() => saveAnchorStep(false)} type="button">{busy === "save-anchors" ? "Menyimpan..." : "Simpan Anchor & Lanjut"}</button></div>
        </Surface>
      ) : null}

      {activeStep === "music" ? (
        <div className="studio-layout studio-layout--music">
          <main className="studio-main">
            <Surface className="studio-panel" tone="quiet">
              <div className="studio-panel__heading"><div><p className="ui-eyebrow">STEP 3 · BACKGROUND MUSIC</p><h2>Pilih template atau upload MP3</h2><p>Music adalah satu continuous timeline dari Hero sampai akhir. Saat video/audio bersuara aktif, hanya gain music yang turun; beat dan playback position tetap jalan.</p></div></div>
              <h3 className="studio-subheading">Template Kenangin</h3>
              <div className="studio-song-grid">
                {compatibleSongs.map((song) => {
                  const selected = backgroundMusic?.source === "catalog" && backgroundMusic.songId === song.id;
                  return (
                    <article className={`studio-song-card ${selected ? "is-selected" : ""}`} key={song.id}>
                      <button onClick={() => selectCatalogSong(song.id)} type="button"><i>{selected ? "✓" : "♪"}</i><div><strong>{song.name}</strong><span>{song.artist} · {Math.round(song.bpm)} BPM · {song.mood.join(" · ")}</span></div></button>
                      {song.track.source === "public" ? <audio controls preload="none" src={song.track.publicPath} /> : null}
                    </article>
                  );
                })}
              </div>
            </Surface>

            <Surface className="studio-panel" tone="quiet">
              <div className="studio-panel__heading studio-panel__heading--compact"><div><p className="ui-eyebrow">YOUR MUSIC</p><h2>Upload MP3 sendiri</h2><p>Upload dulu, lalu tombol Analyze memetakan hash, duration, BPM, beats, onset, energy curve, intro/build/peak/outro.</p></div><button className="ui-button ui-button--secondary" disabled={busy !== null} onClick={() => musicInputRef.current?.click()} type="button"><UploadIcon size={15} /> Pilih MP3</button></div>
              <input accept="audio/mpeg,.mp3" hidden onChange={(event) => setMusicFile(event.target.files?.[0] ?? null)} ref={musicInputRef} type="file" />
              {musicFile ? <div className="studio-music-upload"><div><strong>{musicFile.name}</strong><span>{formatBytes(musicFile.size)} · siap upload</span></div><button className="ui-button ui-button--primary" disabled={busy !== null} onClick={uploadMusic} type="button">{busy === "upload-music" ? "Uploading..." : "Upload MP3"}</button></div> : null}
              <div className="studio-room-music-list">
                {roomMusic.map((item) => {
                  const selected = backgroundMusic?.source === "room-upload" && backgroundMusic.musicId === item.id;
                  return (
                    <article className={`studio-room-music ${selected ? "is-selected" : ""}`} key={item.id}>
                      <div className="studio-room-music__identity"><i>{selected ? "✓" : "♫"}</i><div><strong>{item.name}</strong><span>{formatBytes(item.sizeBytes)} · {item.analysis.status === "ready" ? `${Math.round(item.analysis.bpm ?? 0)} BPM · ${formatDuration(item.analysis.durationSec)}` : "Beatmap belum siap"}</span></div></div>
                      <div className="studio-room-music__actions">
                        {item.analysis.status === "ready" ? <button className="ui-button ui-button--ghost" onClick={() => setBackgroundMusic({ source: "room-upload", musicId: item.id })} type="button">{selected ? "Dipilih" : "Pilih"}</button> : null}
                        <button className="ui-button ui-button--secondary" disabled={busy !== null} onClick={() => analyzeMusic(item)} type="button">{busy === "analyze-music" ? "Analyzing..." : item.analysis.status === "ready" ? "Analyze ulang" : "Analyze"}</button>
                      </div>
                      {item.analysis.status === "ready" ? <div className="studio-beatmap-mini"><span>{item.analysis.beats.length} beats</span><span>{item.analysis.onsets.length} onsets</span><span>{item.analysis.mood.join(" · ")}</span></div> : null}
                    </article>
                  );
                })}
              </div>
            </Surface>
          </main>
          <aside className="studio-side">
            <Surface className="studio-summary-card" tone="quiet"><p className="ui-eyebrow">AUDIO MIX RULE</p><div><strong>100%</strong><span>Beat timeline preserved</span></div><p>Foreground video volume mengikuti setting tiap media. Background music akan fade/duck lebih rendah dari foreground, lalu fade-in lagi di foto atau video tanpa audio.</p></Surface>
            <button className="ui-button ui-button--primary studio-continue" disabled={!backgroundMusic || busy !== null} onClick={saveMusicStep} type="button">{busy === "save-music" ? "Menyimpan..." : "Lanjut ke Experience Director"}</button>
          </aside>
        </div>
      ) : null}

      {activeStep === "direction" ? (
        <div className="studio-direction-stage">
          <Surface className="studio-panel" tone="quiet">
            <div className="studio-panel__heading"><div><p className="ui-eyebrow">STEP 4 · EXPERIENCE DIRECTOR</p><h2>Ubah pilihanmu menjadi ExperienceDNA</h2><p>Gemini hanya memilih vocabulary yang sudah tersedia: section tuning, role, Aura, transition, pacing, energy, beat alignment, wish placement, dan micro-copy. Semua output tetap divalidasi code.</p></div><button className="ui-button ui-button--primary" disabled={busy !== null || !studio.backgroundMusic} onClick={generateDirections} type="button">{busy === "generate" ? "Menyutradarai..." : studio.directionCandidates.length > 0 ? "Regenerate 3 Direction" : "Generate 3 Direction"}</button></div>
            {studio.directionCandidates.length > 0 ? (
              <div className="studio-direction-grid">
                {studio.directionCandidates.map((candidate) => {
                  const selected = studio.selectedDirectionId === candidate.id;
                  return (
                    <article className={`studio-direction-card ${selected ? "is-selected" : ""}`} key={candidate.id}>
                      <div className="studio-direction-card__top"><span>{candidate.generationMode === "gemini" ? "Gemini" : "Fallback"}</span><i>{candidate.sections.length} sections</i></div>
                      <h3>{candidate.name}</h3><p>{candidate.summary}</p>
                      <div className="studio-direction-card__arc">{candidate.storyArc.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
                      <button className={selected ? "ui-button ui-button--secondary" : "ui-button ui-button--ghost"} disabled={busy !== null} onClick={() => chooseDirection(candidate.id)} type="button">{selected ? "Direction dipilih" : "Pilih Direction"}</button>
                    </article>
                  );
                })}
              </div>
            ) : <div className="studio-direction-empty"><strong>Belum ada ExperienceDNA.</strong><span>Generate akan mencoba Gemini lebih dulu; fallback deterministic baru dipakai setelah Director gagal/timeout dan tetap memasukkan seluruh media pilihan.</span></div>}
          </Surface>

          {currentDirection ? <DirectionPreview direction={currentDirection} mediaById={mediaById} previewUrlByMediaId={previewUrlByMediaId} recipientName={recipientName} /> : null}

          <Surface className={`studio-bake-gate ${currentDirection ? "is-ready" : ""}`} tone="quiet">
            <div><p className="ui-eyebrow">NEXT · BAKE</p><h2>{currentDirection ? "Direction final — siap dibangun" : "Pilih satu Direction untuk membuka Bake"}</h2><p>Bake menjalankan preflight deterministic, membuat snapshot Receiver, lalu mempublish token stabil. Gemini tidak dipanggil lagi pada tahap ini.</p></div>
            <div className="studio-bake-gate__checks"><span className={selectedMedia.length > 0 ? "is-done" : ""}>✓ Media</span><span className={studio.backgroundMusic ? "is-done" : ""}>✓ Music</span><span className={currentDirection ? "is-done" : ""}>{currentDirection ? "✓" : "·"} ExperienceDNA</span></div>
            <button className="ui-button ui-button--primary studio-bake-gate__button" disabled={!currentDirection || busy !== null} onClick={() => router.push(`/rooms/${encodeURIComponent(roomId)}/bake`)} type="button">Mulai Bake</button>
          </Surface>
        </div>
      ) : null}
    </div>
  );
}

function DirectionPreview({
  direction,
  mediaById,
  previewUrlByMediaId,
  recipientName,
}: {
  direction: ExperienceDNA;
  mediaById: Map<string, Media>;
  previewUrlByMediaId: Record<string, string>;
  recipientName: string;
}) {
  return (
    <Surface className="studio-preview" tone="elevated">
      <div className="studio-preview__heading"><div><p className="ui-eyebrow">DETERMINISTIC PREVIEW MAP</p><h2>{direction.name}</h2><p>Preview ini memeriksa execution plan per-section. Aura/transition renderer penuh baru dieksekusi Receiver Engine Patch 9.</p></div><span>{direction.generationMode}</span></div>
      <div className="studio-preview__sections">
        {direction.sections.map((section, index) => (
          <article className={`studio-preview-section studio-preview-section--${section.type}`} key={section.id}>
            <div className="studio-preview-section__index"><span>{index + 1}</span><small>{section.type}</small></div>
            <div className="studio-preview-section__visual">
              {section.type === "hero" ? <div className="studio-preview-hero"><small>Untuk</small><strong>{recipientName}</strong><span>{section.microCopy ?? "Sebuah kenangan yang dibuat bersama."}</span></div> : null}
              {section.type === "video" ? (() => {
                const item = mediaById.get(section.mediaIds[0]);
                const url = item ? previewUrlByMediaId[item.id] : null;
                return url ? <video controls playsInline preload="metadata" src={url} /> : <span><VideoIcon size={24} />Video</span>;
              })() : null}
              {section.type === "photo-slide" ? <div className="studio-preview-photo-grid">{section.mediaIds.slice(0, 6).map((id) => {
                const item = mediaById.get(id);
                const url = item ? previewUrlByMediaId[id] : null;
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item?.originalFileName ?? "Foto"} key={id} src={url} />
                ) : <span key={id}><PhotoIcon size={18} /></span>;
              })}</div> : null}
            </div>
            <div className="studio-preview-section__tuning"><strong>{section.role ?? "hero"}</strong><span>{section.auraIds.join(" + ")}</span><span>{section.transitionInId}</span><span>{section.audioMix.mode}</span><span>{section.dwellSeconds.toFixed(1)}s · intensity {Math.round(section.intensity * 100)}%</span>{section.type === "video" ? <span>foreground volume {Math.round((section.mediaTreatment[0]?.volume ?? 1) * 100)}%</span> : null}</div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
