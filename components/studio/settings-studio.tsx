"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
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
import { studioSettingsRequestSchema, studioMediaSettingSchema } from "@/lib/studio/contracts";
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
  const [exitOpen, setExitOpen] = useState(false);
  const [exitTarget, setExitTarget] = useState(`/rooms/${encodeURIComponent(roomId)}`);
  const [draftReady, setDraftReady] = useState(false);
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

  const dirty = !mediaStepPersisted || JSON.stringify(anchors) !== JSON.stringify(studio.storyAnchors) || JSON.stringify(backgroundMusic) !== JSON.stringify(studio.backgroundMusic);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(`kenangin-studio:${roomId}`);
        if (raw) {
          const draft = studioSettingsRequestSchema.extend({ selectedMedia: studioMediaSettingSchema.array().max(100) }).safeParse(JSON.parse(raw));
          if (draft.success && draft.data.expectedStudioUpdatedAt === initialStudio.updatedAt && draft.data.selectedMedia.every(item => initialMedia.some(media => media.id === item.mediaId))) {
            setSelectedMedia(draft.data.selectedMedia);
            setAnchors(draft.data.storyAnchors);
            setThemeId(draft.data.themeId);
            setBackgroundMusic(draft.data.backgroundMusic);
            setActiveStep("media");
            setNotice("Pilihan yang belum tersimpan dipulihkan dari tab ini. Periksa lalu lanjutkan untuk menyimpan.");
          } else sessionStorage.removeItem(`kenangin-studio:${roomId}`);
        }
      } catch { /* Storage can be unavailable in private browsing. */ }
      setDraftReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [roomId, initialStudio.updatedAt, initialMedia]);
  useEffect(() => {
    if (!draftReady) return;
    try {
      const key = `kenangin-studio:${roomId}`;
      if (!dirty) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify({ expectedStudioUpdatedAt: studio.updatedAt, selectedMedia, storyAnchors: anchors, storyAnchorsConfirmed: studio.storyAnchorsConfirmed, themeId, backgroundMusic }));
    } catch { /* The navigation guard still protects edits if storage is denied. */ }
  }, [draftReady, dirty, roomId, studio.updatedAt, studio.storyAnchorsConfirmed, selectedMedia, anchors, themeId, backgroundMusic]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault(); event.stopPropagation();
      if (!busy) { setExitTarget(url.pathname + url.search + url.hash); setExitOpen(true); }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [dirty, busy]);
  useEffect(() => {
    document.querySelector<HTMLElement>(".studio-stepper")?.scrollIntoView({ block: "start" });
  }, [activeStep]);
  async function saveAndExit() {
    setBusy("save-media");
    try {
      await persistSettings({ storyAnchorsConfirmed: studio.storyAnchorsConfirmed && mediaStepPersisted });
      router.push(exitTarget);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Draf belum tersimpan."); setExitOpen(false); }
    finally { setBusy(null); }
  }

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
    if (selectedMedia.length >= 100 || selectedVideoCount + Number(selectedPhotoCount > 0 || item.type === "photo") + Number(item.type === "video") > 79) {
      setError("Pilih maksimal 100 media dengan 79 bagian cerita. Semua foto ditempatkan dalam satu album.");
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
        expectedStudioUpdatedAt: studio.updatedAt,
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
    setSelectedMedia(nextStudio.selectedMedia);
    setThemeId(nextStudio.themeId);
    setAnchors(nextStudio.storyAnchors);
    setBackgroundMusic(nextStudio.backgroundMusic);
    return nextStudio;
  }

  async function saveMediaStep() {
    if (busy || selectedMedia.length === 0) return;
    if (mediaStepPersisted) { setActiveStep("anchors"); return; }
    clearFeedback();
    setBusy("save-media");
    try {
      const next = await persistSettings({ storyAnchorsConfirmed: false, nextAnchors: cleanAnchors(anchors, selectedMedia) });
      setStudio(next);
      setActiveStep("anchors");
      setNotice(`${selectedMedia.length} momen tersimpan. Selanjutnya, beri petunjuk cerita atau langsung lanjutkan.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Pilihan media belum tersimpan.");
    } finally {
      setBusy(null);
    }
  }

  function toggleAnchor(role: keyof StoryAnchors, mediaId: string) {
    setAnchors((current) => {
      const exists = current[role].includes(mediaId);
      if (!exists && current[role].length >= 8) return current;
      return { ...current, [role]: exists ? current[role].filter((id) => id !== mediaId) : [...current[role], mediaId] };
    });
  }

  async function saveAnchorStep(skip = false) {
    if (busy) return;
    if (!skip && anchorsStepPersisted) { setActiveStep("music"); return; }
    clearFeedback();
    setBusy("save-anchors");
    const nextAnchors = skip ? EMPTY_ANCHORS : anchors;
    try {
      const next = await persistSettings({ storyAnchorsConfirmed: true, nextAnchors });
      setAnchors(next.storyAnchors);
      setActiveStep("music");
      setNotice(skip ? "Petunjuk dilewati. Kami akan merangkai alur dari momen pilihanmu." : "Petunjuk cerita tersimpan.");
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
        setError("Tekan Siapkan musik pada lagu yang diunggah sebelum melanjutkan.");
        return;
      }
    }
    if (musicStepPersisted) { setActiveStep("direction"); return; }
    setBusy("save-music");
    try {
      const next = await persistSettings({ storyAnchorsConfirmed: true, nextBackgroundMusic: backgroundMusic });
      setStudio(next);
      setActiveStep("direction");
      setNotice("Musik tersimpan. Sekarang pilih gaya ceritamu.");
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
      setDeepAnalysisNote("Sedang merangkai tiga gaya dari momen dan musik pilihanmu. Proses ini dapat memerlukan sekitar satu menit.");
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/studio/generate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ variantCount: 3, expectedStudioUpdatedAt: studio.updatedAt }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Experience Director gagal menyusun direction.");
      const next = payload.data.studio as RoomStudioConfig;
      setStudio(next);
      const mode = next.directionCandidates[0]?.generationMode;
      setNotice(mode === "fallback"
        ? "Layanan AI sedang tidak tersedia. Tiga gaya bawaan telah disiapkan dengan semua momen pilihanmu."
        : `${next.directionCandidates.length} gaya cerita siap dipilih.`);
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
        body: JSON.stringify({ directionId, expectedStudioUpdatedAt: studio.updatedAt }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Direction belum dapat dipilih.");
      const next = payload.data.studio as RoomStudioConfig;
      setStudio(next);
      setNotice("Gaya cerita tersimpan. Lanjutkan untuk meninjau dan menerbitkan.");
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
    music: !mediaStepPersisted || !anchorsStepPersisted ? "locked" : musicStepPersisted ? "done" : "active",
    direction: !mediaStepPersisted || !anchorsStepPersisted || !musicStepPersisted ? "locked" : studio.selectedDirectionId ? "done" : "active",
  } as const;

  return (
    <div className="settings-studio">
      <div className={`studio-save-state ${dirty ? "is-dirty" : ""}`} role="status">{dirty ? "Ada perubahan. Tekan Lanjut untuk menyimpan." : "Semua pilihan tersimpan."}</div>
      <Surface className="studio-stepper" tone="quiet">
        {(["media", "anchors", "music", "direction"] as StudioStep[]).map((step, index) => {
          const labels = {
            media: ["Momen", "Foto & video"],
            anchors: ["Petunjuk", "Opsional"],
            music: ["Musik", "Bangun suasana"],
            direction: ["Gaya cerita", "Pilih favoritmu"],
          } as const;
          const locked = stepState[step] === "locked";
          return (
            <button
              className={`studio-step studio-step--${stepState[step]} ${activeStep === step ? "is-current" : ""}`}
              disabled={locked || busy !== null}
              aria-current={activeStep === step ? "step" : undefined}
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
          <div className="studio-main">
            <Surface className="studio-panel" tone="quiet">
              <div className="studio-panel__heading">
                <div><p className="ui-eyebrow">LANGKAH 1 · MOMEN</p><h2>Momen mana yang ingin kamu ceritakan?</h2><p>Pilih foto dan video favoritmu. Semua yang kamu pilih akan tampil dalam cerita.</p></div>
                <strong>{selectedMedia.length}/{media.length}</strong>
              </div>
              <div className="studio-media-grid">
                {media.map((item) => {
                  const selected = selectedIds.has(item.id);
                  const url = previewUrlByMediaId[item.id];
                  return (
                    <button className={`studio-media-choice ${selected ? "is-selected" : ""}`} aria-pressed={selected} key={item.id} onClick={() => toggleMedia(item)} type="button">
                      <div className="studio-media-choice__preview">
                        {url ? item.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={item.originalFileName} src={url} />
                        ) : <video muted playsInline preload="metadata" src={url} /> : <span>{item.type === "photo" ? <PhotoIcon size={22} /> : <VideoIcon size={22} />}</span>}
                        <i>{selected ? "✓" : "+"}</i>
                      </div>
                      <div><strong>{item.originalFileName}</strong><span>{item.type === "video" ? `Video · ${formatDuration(item.durationSec ?? item.technicalSignals?.durationSec)}` : "Foto"}</span></div>
                    </button>
                  );
                })}
              </div>
            </Surface>

            {selectedItems.length > 0 ? (
              <details className="studio-panel workspace-panel studio-media-detail"><summary>Urutan & pengaturan media</summary>
                <div className="studio-panel__heading"><div><p className="ui-eyebrow">DETAIL MEDIA</p><h2>Sesuaikan dengan caramu</h2><p>Atur urutan, tampilan, dan suara video. Musik akan melunak ketika suara video diputar.</p></div></div>
                <div className="studio-selected-list">
                  {selectedItems.map(({ setting, media: item }, index) => (
                    <article className="studio-selected-media" key={item.id}>
                      <div className="studio-selected-media__order"><strong>{index + 1}</strong><div><button aria-label={`Pindah ${item.originalFileName} ke atas`} disabled={index === 0} onClick={() => moveMedia(item.id, -1)} type="button">↑</button><button aria-label={`Pindah ${item.originalFileName} ke bawah`} disabled={index === selectedItems.length - 1} onClick={() => moveMedia(item.id, 1)} type="button">↓</button></div></div>
                      <div className="studio-selected-media__identity"><span>{item.type === "video" ? <VideoIcon size={15} /> : <PhotoIcon size={15} />}</span><div><strong>{item.originalFileName}</strong><small>{item.type === "video" ? "Video" : "Foto dalam album"}</small></div></div>
                      <label className="studio-control"><span>Tampilan</span><select value={setting.fit} onChange={(event) => updateMediaSetting(item.id, { fit: event.target.value as "cover" | "contain" })}><option value="cover">Penuhi bingkai</option><option value="contain">Tampilkan utuh</option></select></label>
                      {item.type === "video" ? (
                        <>
                          <label className="studio-control studio-control--volume"><span>Volume media <b>{Math.round(setting.volume * 100)}%</b></span><input max="1" min="0" onChange={(event) => updateMediaSetting(item.id, { volume: Number(event.target.value) })} step="0.05" type="range" value={setting.volume} /></label>
                          <label className="studio-control"><span>Mulai (detik)</span><input min="0" onChange={(event) => updateMediaSetting(item.id, { trimInSec: event.target.value ? Number(event.target.value) : null })} placeholder="0" step="0.1" type="number" value={setting.trimInSec ?? ""} /></label>
                          <label className="studio-control"><span>Akhir (detik)</span><input min="0" onChange={(event) => updateMediaSetting(item.id, { trimOutSec: event.target.value ? Number(event.target.value) : null })} placeholder={formatDuration(item.durationSec ?? item.technicalSignals?.durationSec)} step="0.1" type="number" value={setting.trimOutSec ?? ""} /></label>
                          <label className="studio-check"><input checked={setting.loop} onChange={(event) => updateMediaSetting(item.id, { loop: event.target.checked })} type="checkbox" /><span>Putar ulang video</span></label>
                        </>
                      ) : <span className="studio-photo-audio-note">Musik mengiringi foto ini</span>}
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <aside className="studio-side">
            <Surface className="studio-summary-card" tone="quiet">
              <p className="ui-eyebrow">MOMEN PILIHAN</p>
              <div><strong>{selectedVideoCount}</strong><span>Video</span></div>
              <div><strong>{selectedPhotoCount > 0 ? 1 : 0}</strong><span>Album foto</span></div>
              <div><strong>{selectedMedia.length > 0 ? 1 + selectedVideoCount + (selectedPhotoCount > 0 ? 1 : 0) : 0}</strong><span>Bagian cerita</span></div>
            </Surface>
            <Surface className="studio-summary-card" tone="quiet">
              <p className="ui-eyebrow">SUASANA</p>
              <label className="studio-control"><span>Suasana cerita</span><select onChange={(event) => changeTheme(event.target.value as ThemeId)} value={themeId}>{curatedThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
              <p>{curatedThemes.find((theme) => theme.id === themeId)?.description}</p>
            </Surface>
            <button className="ui-button ui-button--primary studio-continue" disabled={selectedMedia.length === 0 || busy !== null} onClick={saveMediaStep} type="button">{busy === "save-media" ? "Menyimpan..." : "Lanjut ke Story Anchors"}</button>
          </aside>
        </div>
      ) : null}

      {activeStep === "anchors" ? (
        <Surface className="studio-panel studio-anchor-panel" tone="quiet">
          <div className="studio-panel__heading"><div><p className="ui-eyebrow">LANGKAH 2 · PETUNJUK</p><h2>Tentukan momen yang paling berarti</h2><p>Bantu kami mengenali pembuka, puncak, dan penutup cerita. Kamu juga boleh melewati langkah ini.</p></div></div>
          <div className="studio-anchor-groups">
            {(["opening", "climax", "ending"] as const).map((role) => {
              const copy = {
                opening: ["Pembuka", "Media mana yang cocok membuka cerita?"],
                climax: ["Puncak cerita", "Momen mana yang paling penting atau berkesan?"],
                ending: ["Penutup", "Media mana yang ingin ditinggalkan sebagai kesan terakhir?"],
              } as const;
              return (
                <section className="studio-anchor-group" key={role}>
                  <div><strong>{copy[role][0]}</strong><span>{copy[role][1]}</span><small>{anchors[role].length} dipilih</small></div>
                  <div className="studio-anchor-media-list">
                    {selectedItems.map(({ media: item }) => (
                      <button className={anchors[role].includes(item.id) ? "is-selected" : ""} aria-pressed={anchors[role].includes(item.id)} key={item.id} onClick={() => toggleAnchor(role, item.id)} type="button">
                        <span>{item.type === "video" ? <VideoIcon size={14} /> : <PhotoIcon size={14} />}</span><strong>{item.originalFileName}</strong><i>{anchors[role].includes(item.id) ? "✓" : "+"}</i>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="studio-save-state">Boleh dikosongkan. Maksimal 8 momen untuk setiap bagian cerita.</p>
        </Surface>
      ) : null}

      {activeStep === "music" ? (
        <div className="studio-layout studio-layout--music">
          <div className="studio-main">
            <Surface className="studio-panel" tone="quiet">
              <div className="studio-panel__heading"><div><p className="ui-eyebrow">LANGKAH 3 · MUSIK</p><h2>Musik yang membuatnya terasa dekat</h2><p>Dengarkan cuplikannya, lalu pilih lagu yang paling cocok. Musik mengiringi cerita dari awal sampai akhir.</p></div></div>
              <h3 className="studio-subheading">Koleksi Kenangin</h3>
              <div className="studio-song-grid">
                {compatibleSongs.map((song) => {
                  const selected = backgroundMusic?.source === "catalog" && backgroundMusic.songId === song.id;
                  return (
                    <article className={`studio-song-card ${selected ? "is-selected" : ""}`} key={song.id}>
                      <button aria-pressed={selected} onClick={() => selectCatalogSong(song.id)} type="button"><i>{selected ? "✓" : "♪"}</i><div><strong>{song.name}</strong><span>{song.artist} · {Math.round(song.bpm)} BPM · {song.mood.join(" · ")}</span></div></button>
                      {song.track.source === "public" ? <audio controls preload="none" src={song.track.publicPath} /> : null}
                    </article>
                  );
                })}
              </div>
            </Surface>

            <Surface className="studio-panel" tone="quiet">
              <div className="studio-panel__heading studio-panel__heading--compact"><div><p className="ui-eyebrow">LAGU PILIHANMU</p><h2>Upload MP3 sendiri</h2><p>Punya lagu spesial? Unggah MP3 hingga 30 MB, lalu siapkan musiknya sebelum melanjutkan.</p></div><button className="ui-button ui-button--secondary" disabled={busy !== null} onClick={() => musicInputRef.current?.click()} type="button"><UploadIcon size={15} /> Pilih MP3</button></div>
              <input accept="audio/mpeg,.mp3" hidden onChange={(event) => setMusicFile(event.target.files?.[0] ?? null)} ref={musicInputRef} type="file" />
              {musicFile ? <div className="studio-music-upload"><div><strong>{musicFile.name}</strong><span>{formatBytes(musicFile.size)} · siap upload</span></div><button className="ui-button ui-button--primary" disabled={busy !== null} onClick={uploadMusic} type="button">{busy === "upload-music" ? "Uploading..." : "Upload MP3"}</button></div> : null}
              <div className="studio-room-music-list">
                {roomMusic.map((item) => {
                  const selected = backgroundMusic?.source === "room-upload" && backgroundMusic.musicId === item.id;
                  return (
                    <article className={`studio-room-music ${selected ? "is-selected" : ""}`} key={item.id}>
                      <div className="studio-room-music__identity"><i>{selected ? "✓" : "♫"}</i><div><strong>{item.name}</strong><span>{formatBytes(item.sizeBytes)} · {item.analysis.status === "ready" ? `${Math.round(item.analysis.bpm ?? 0)} BPM · ${formatDuration(item.analysis.durationSec)}` : "Perlu disiapkan sebelum dipilih"}</span></div></div>
                      <div className="studio-room-music__actions">
                        {item.analysis.status === "ready" ? <button className="ui-button ui-button--ghost" onClick={() => setBackgroundMusic({ source: "room-upload", musicId: item.id })} type="button">{selected ? "Dipilih" : "Pilih"}</button> : null}
                        <button className="ui-button ui-button--secondary" disabled={busy !== null} onClick={() => analyzeMusic(item)} type="button">{busy === "analyze-music" ? "Menyiapkan…" : item.analysis.status === "ready" ? "Siapkan ulang" : "Siapkan musik"}</button>
                      </div>
                      {item.analysis.status === "ready" ? <div className="studio-beatmap-mini"><span>{item.analysis.beats.length} beats</span><span>{item.analysis.onsets.length} onsets</span><span>{item.analysis.mood.join(" · ")}</span></div> : null}
                    </article>
                  );
                })}
              </div>
            </Surface>
          </div>
          <aside className="studio-side">
            <Surface className="studio-summary-card" tone="quiet"><p className="ui-eyebrow">NYAMAN DIDENGAR</p><div><strong>100%</strong><span>Musik tetap mengalir</span></div><p>Suara video tetap jelas. Musik melunak saat video bersuara diputar, lalu kembali ketika kamu melanjutkan ke foto.</p></Surface>
            <button className="ui-button ui-button--primary studio-continue" disabled={!backgroundMusic || busy !== null} onClick={saveMusicStep} type="button">{busy === "save-music" ? "Menyimpan..." : "Lanjut ke Experience Director"}</button>
          </aside>
        </div>
      ) : null}

      {activeStep === "direction" ? (
        <div className="studio-direction-stage">
          <Surface className="studio-panel" tone="quiet">
            <div className="studio-panel__heading"><div><p className="ui-eyebrow">LANGKAH 4 · GAYA CERITA</p><h2>Satu cerita, tiga cara merasakannya</h2><p>Kami merangkai pilihanmu menjadi tiga gaya. Pilih yang paling terasa pas, lalu lihat urutan cerita di bawah.</p></div><button className="ui-button ui-button--primary" disabled={busy !== null || !studio.backgroundMusic} onClick={generateDirections} type="button">{busy === "generate" ? "Menyutradarai..." : studio.directionCandidates.length > 0 ? "Buat pilihan lain" : "Buat 3 gaya cerita"}</button></div>
            {studio.directionCandidates.length > 0 ? (
              <div className="studio-direction-grid">
                {studio.directionCandidates.map((candidate) => {
                  const selected = studio.selectedDirectionId === candidate.id;
                  return (
                    <article className={`studio-direction-card ${selected ? "is-selected" : ""}`} key={candidate.id}>
                      <div className="studio-direction-card__top"><span>{candidate.generationMode === "gemini" ? "Dirangkai untukmu" : "Gaya bawaan"}</span><i>{candidate.sections.length} bagian</i></div>
                      <h3>{candidate.name}</h3><p>{candidate.summary}</p>
                      <div className="studio-direction-card__arc">{candidate.storyArc.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
                      <button className={selected ? "ui-button ui-button--secondary" : "ui-button ui-button--ghost"} disabled={busy !== null} onClick={() => chooseDirection(candidate.id)} type="button">{selected ? "✓ Gaya dipilih" : "Pilih gaya ini"}</button>
                    </article>
                  );
                })}
              </div>
            ) : <div className="studio-direction-empty"><strong>Ceritamu siap dirangkai.</strong><span>Tekan Buat 3 gaya cerita untuk mulai. Semua momen pilihanmu tetap disertakan.</span></div>}
          </Surface>

          {currentDirection ? <DirectionPreview direction={currentDirection} mediaById={mediaById} previewUrlByMediaId={previewUrlByMediaId} recipientName={recipientName} /> : null}

          <Surface className={`studio-bake-gate ${currentDirection ? "is-ready" : ""}`} tone="quiet">
            <div><p className="ui-eyebrow">SELANGKAH LAGI</p><h2>{currentDirection ? "Ceritamu siap diterbitkan" : "Pilih gaya favoritmu dulu"}</h2><p>Langkah berikutnya memeriksa semua media dan menyiapkan tautan kejutan. Kamu bisa kembali mengubahnya kapan saja.</p></div>
            <div className="studio-bake-gate__checks"><span className={selectedMedia.length > 0 ? "is-done" : ""}>✓ Media</span><span className={studio.backgroundMusic ? "is-done" : ""}>✓ Musik</span><span className={currentDirection ? "is-done" : ""}>{currentDirection ? "✓" : "·"} Gaya cerita</span></div>
            <button className="ui-button ui-button--primary studio-bake-gate__button" disabled={!currentDirection || busy !== null} onClick={() => router.push(`/rooms/${encodeURIComponent(roomId)}/bake`)} type="button">Mulai Bake</button>
          </Surface>
        </div>
      ) : null}

      <div className="journey-actionbar">
        <div className="journey-actionbar__copy"><strong>{({ media: "1 dari 4 · Pilih momen", anchors: "2 dari 4 · Petunjuk cerita", music: "3 dari 4 · Pilih musik", direction: "4 dari 4 · Pilih gaya cerita" })[activeStep]}</strong><small>{busy ? "Sedang memproses. Tunggu sebentar…" : activeStep === "anchors" ? "Langkah ini opsional. Lanjutkan dengan pilihan kosong bila ingin." : activeStep === "direction" ? "Pilih satu gaya di atas, lalu tinjau dan terbitkan." : "Pilihanmu disimpan saat melanjutkan."}</small></div>
        <div className="journey-actionbar__buttons">
          <button className="ui-button ui-button--ghost" disabled={busy !== null} onClick={() => { if (activeStep === "media") { if (dirty) { setExitTarget("/rooms/" + encodeURIComponent(roomId)); setExitOpen(true); } else router.push("/rooms/" + encodeURIComponent(roomId)); } else setActiveStep(activeStep === "anchors" ? "media" : activeStep === "music" ? "anchors" : "music"); }}>← {activeStep === "media" ? "Ke Room" : "Kembali"}</button>
          <button className="ui-button ui-button--primary" disabled={busy !== null || (activeStep === "media" && !selectedMedia.length) || (activeStep === "music" && !backgroundMusic) || (activeStep === "direction" && (!currentDirection || dirty))} onClick={() => { if (activeStep === "media") void saveMediaStep(); else if (activeStep === "anchors") void saveAnchorStep(); else if (activeStep === "music") void saveMusicStep(); else router.push("/rooms/" + encodeURIComponent(roomId) + "/bake"); }}>{busy ? "Memproses…" : activeStep === "direction" ? "Tinjau & terbitkan →" : "Simpan & lanjut →"}</button>
        </div>
      </div>
      <Dialog open={exitOpen} onClose={() => setExitOpen(false)} title="Simpan sebelum kembali?" busy={busy !== null}><p>Simpan perubahan ke Room agar bisa dilanjutkan dari perangkat lain.</p><div className="finish-secondary"><button className="ui-button ui-button--ghost" disabled={busy !== null} onClick={() => setExitOpen(false)}>Tetap di sini</button><button className="ui-button ui-button--primary" disabled={busy !== null || !selectedMedia.length} onClick={saveAndExit}>{busy ? "Menyimpan…" : "Simpan & kembali"}</button><button className="ui-button ui-button--ghost" disabled={busy !== null} onClick={() => { try { sessionStorage.removeItem(`kenangin-studio:${roomId}`); } catch {} router.push(exitTarget); }}>Buang perubahan & keluar</button></div></Dialog>
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
      <div className="studio-preview__heading"><div><p className="ui-eyebrow">URUTAN CERITAMU</p><h2>{direction.name}</h2><p>Tinjau alurnya sebelum diterbitkan. Foto dan video di bawah mengikuti pilihanmu.</p></div><span>{direction.sections.length} bagian cerita</span></div>
      <div className="studio-preview__sections">
        {direction.sections.map((section, index) => (
          <article className={`studio-preview-section studio-preview-section--${section.type}`} key={section.id}>
            <div className="studio-preview-section__index"><span>{index + 1}</span><small>{section.type === "hero" ? "Pembuka" : section.type === "video" ? "Video" : "Album"}</small></div>
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
            <div className="studio-preview-section__tuning"><strong>{section.type === "hero" ? "Pembuka" : section.type === "video" ? "Momen bergerak" : "Album kenangan"}</strong><span>{section.mediaIds.length ? section.mediaIds.length + " media" : "Untuk " + recipientName}</span>{section.microCopy ? <p>{section.microCopy}</p> : null}</div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
