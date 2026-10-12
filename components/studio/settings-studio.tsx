"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { curatedThemes } from "@/config/themes";
import { Dialog } from "@/components/ui/dialog";
import { ReceiverExperience } from "@/components/receiver/receiver-experience";
import type { RoomMusic } from "@/lib/creative";
import type { Media, ReceiverManifest } from "@/lib/data/contracts";
import { defaultSceneAtmosphere, studioSettingsRequestSchema, type RoomStudioConfig, type StudioMediaSetting, type StudioSectionPlan } from "@/lib/studio/contracts";
import { sectionLabel, sectionProblems, upgradeStudioAuthoring } from "@/lib/studio/authoring";
import { buildStudioSectionPlan } from "@/lib/studio/section-plan";
import { SectionEditor, MediaInspection, MediaThumbnail } from "./section-editor";
import { MusicLibrary, studioRequest } from "./music-library";
import { AtmosphereControls } from "./atmosphere-controls";
import { MusicVolume } from "./music-volume";
import { analyzeRoomMusicFile } from "@/lib/studio/music-client";

type Step = "media" | "arrange" | "music" | "preview";
const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "media", label: "Momen", description: "Pilih bahan ceritamu" },
  { id: "arrange", label: "Atur Cerita", description: "Setiap momen punya tempat" },
  { id: "music", label: "Musik", description: "Suara yang kamu pilih" },
  { id: "preview", label: "Pratinjau & Suasana", description: "Rasakan sebelum dibagikan" },
];
type Draft = Pick<RoomStudioConfig, "selectedMedia" | "sectionPlan" | "themeId" | "backgroundMusic"> & { atmosphere: typeof defaultSceneAtmosphere };
type Preview = { manifest: ReceiverManifest; assetUrls: Record<string, string>; studioUpdatedAt: string };
function draftFrom(studio: RoomStudioConfig): Draft { return { selectedMedia: studio.selectedMedia, sectionPlan: studio.sectionPlan, themeId: studio.themeId, backgroundMusic: studio.backgroundMusic, atmosphere: studio.atmosphere ?? defaultSceneAtmosphere }; }
function mediaSetting(item: Media, order: number): StudioMediaSetting { return { mediaId: item.id, order, volume: item.type === "video" ? 1 : 0, trimInSec: null, trimOutSec: null, loop: false, fit: "contain" }; }

export function SettingsStudio({ roomId, recipientName, media, previewUrlByMediaId, initialStudio, initialRoomMusic }: {
  roomId: string; recipientName: string; media: Media[]; previewUrlByMediaId: Record<string, string>; initialStudio: RoomStudioConfig; initialRoomMusic: RoomMusic[];
}) {
  const router = useRouter();
  const [studio, setStudio] = useState(() => upgradeStudioAuthoring(initialStudio));
  const [draft, setDraft] = useState<Draft>(() => draftFrom(upgradeStudioAuthoring(initialStudio)));
  const [activeStep, setActiveStep] = useState<Step>(initialStudio.sectionPlan.length ? "arrange" : "media");
  const [tracks, setTracks] = useState(initialRoomMusic);
  const [busy, setBusy] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; serial: number } | undefined>();
  const [inspected, setInspected] = useState<Media | null>(null);
  const [removeMedia, setRemoveMedia] = useState<Media | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [musicTarget, setMusicTarget] = useState<string | null>(null);
  const [editingAtmosphere, setEditingAtmosphere] = useState<string | null>(null);
  const [exitTarget, setExitTarget] = useState<string | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const previewStage = useRef<HTMLDivElement>(null);
  const videoAudioPrepared = useRef(new Set(media.filter(item => item.audioBeatmap).map(item => item.id)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(studio));
  const locked = busy || musicBusy;
  const selectedIds = new Set(draft.selectedMedia.map(item => item.mediaId));
  const assignedIds = new Set(draft.sectionPlan.flatMap(section => section.mediaIds));
  const problems = sectionProblems(draft, media);
  const activeIndex = STEPS.findIndex(step => step.id === activeStep);
  const base = `/api/rooms/${encodeURIComponent(roomId)}/studio`;
  const musicSection = draft.sectionPlan.find(section => section.id === musicTarget);
  const atmosphereSection = draft.sectionPlan.find(section => section.id === editingAtmosphere);

  function focusSection(id: string) {
    setFocusRequest(previous => ({ id, serial: (previous?.serial ?? 0) + 1 }));
    previewStage.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const key = `kenangin-studio:${roomId}`;
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const stored = studioSettingsRequestSchema.safeParse(JSON.parse(raw));
          if (stored.success && stored.data.expectedStudioUpdatedAt === initialStudio.updatedAt && stored.data.selectedMedia.every(item => media.some(current => current.id === item.mediaId))) {
            const restored = { ...draftFrom(upgradeStudioAuthoring(initialStudio)), ...stored.data };
            setDraft({ selectedMedia: restored.selectedMedia, sectionPlan: restored.sectionPlan, themeId: restored.themeId, backgroundMusic: restored.backgroundMusic, atmosphere: restored.atmosphere });
            setNotice("Draf dari tab ini dipulihkan. Section, keterangan, dan pilihan musikmu tetap ada.");
          } else sessionStorage.removeItem(key);
        }
      } catch { /* The navigation guard still protects edits when storage is unavailable. */ }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [roomId, initialStudio, media]);
  useEffect(() => {
    if (!ready) return;
    try {
      const key = `kenangin-studio:${roomId}`;
      if (!dirty) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify({ ...draft, expectedStudioUpdatedAt: studio.updatedAt, storyAnchors: { opening: [], climax: [], ending: [] }, storyAnchorsConfirmed: true }));
    } catch { /* Browser storage can be full or disabled. */ }
  }, [ready, dirty, draft, studio.updatedAt, roomId]);
  useEffect(() => {
    if (!dirty && !locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const guard = (event: MouseEvent) => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname && url.search === location.search) return;
      event.preventDefault(); event.stopPropagation(); if (!locked) setExitTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); };
  }, [dirty, locked]);
  useEffect(() => { heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, [activeStep]);
  function update(patch: Partial<Draft>) { setDraft(current => ({ ...current, ...patch })); setError(""); setNotice(""); }
  function sectionsChanged(sectionPlan: StudioSectionPlan[]) { update({ sectionPlan }); }
  function patchSection(id: string, patch: Partial<StudioSectionPlan>) { sectionsChanged(draft.sectionPlan.map(section => section.id === id ? { ...section, ...patch } : section)); }
  function removeSelected(item: Media) {
    update({ selectedMedia: draft.selectedMedia.filter(setting => setting.mediaId !== item.id).map((setting, order) => ({ ...setting, order })), sectionPlan: draft.sectionPlan.map(section => ({ ...section, mediaIds: section.mediaIds.filter(id => id !== item.id) })) });
    setRemoveMedia(null);
  }
  function toggleMedia(item: Media) {
    if (selectedIds.has(item.id)) { if (assignedIds.has(item.id)) setRemoveMedia(item); else removeSelected(item); return; }
    if (draft.selectedMedia.length >= 100) { setError("Pilih maksimal 100 media untuk Room ini."); return; }
    update({ selectedMedia: [...draft.selectedMedia, mediaSetting(item, draft.selectedMedia.length)] });
  }
  function recommend() {
    if (!draft.selectedMedia.length) { setError("Pilih beberapa media di Momen terlebih dahulu, atau tambahkan section Teks sendiri."); return; }
    const sections = buildStudioSectionPlan(draft.selectedMedia, media);
    if (sections.length > 80) { setError("Pilih lebih sedikit momen atau susun beberapa video ke dalam Slider Video."); return; }
    sectionsChanged(sections); setReplaceOpen(false); setNotice("Susunan awal siap. Ganti judul, tambahkan keterangan, dan pindahkan section sesukamu.");
  }
  async function persist(preparePreview = false) {
    const { studio: saved } = await studioRequest<{ studio: RoomStudioConfig }>(`${base}/settings`, {
      ...draft, expectedStudioUpdatedAt: studio.updatedAt, preparePreview,
      storyAnchors: { opening: [], climax: [], ending: [] }, storyAnchorsConfirmed: true,
    }, "PATCH");
    setStudio(saved); setDraft(draftFrom(saved)); return saved;
  }
  async function saveOnly() {
    if (locked) return;
    setBusy(true); setError("");
    try { await persist(); setNotice("Draf tersimpan, termasuk section yang masih kosong."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Draf belum tersimpan."); }
    finally { setBusy(false); }
  }
  async function navigate(step: Step) {
    if (locked) return;
    if ((step === "music" || step === "preview") && problems.length) { setError(problems[0]); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (step === "preview") {
        const videoWarnings: string[] = [];
        for (const item of media.filter(item => item.type === "video" && assignedIds.has(item.id) && !videoAudioPrepared.current.has(item.id) && item.technicalSignals?.audioPresence !== "absent" && (draft.selectedMedia.find(setting => setting.mediaId === item.id)?.volume ?? 0) > 0)) {
          try {
            setNotice(`Menyiapkan Aura dari suara video ${item.originalFileName}…`);
            // Studio can stay open beyond the 15-minute media URL lifetime.
            const fresh = await studioRequest<{ previewUrlByMediaId: Record<string, string> }>(`/api/rooms/${encodeURIComponent(roomId)}/media/preview-urls`, { media: [{ id: item.id, objectKey: item.storageObjectKey }] });
            const response = await fetch(fresh.previewUrlByMediaId[item.id]);
            if (!response.ok) throw new Error("Video belum dapat dibaca. Muat ulang halaman untuk memperbarui aksesnya.");
            const analysis = await analyzeRoomMusicFile(new File([await response.blob()], item.originalFileName, { type: item.contentType }));
            await studioRequest(`/api/rooms/${encodeURIComponent(roomId)}/media/${encodeURIComponent(item.id)}/audio-analysis`, analysis);
            videoAudioPrepared.current.add(item.id);
          } catch (caught) { videoWarnings.push(`${item.originalFileName} (${caught instanceof Error ? caught.message : "audio belum dapat dibaca"})`); }
        }
        await persist(true);
        const next = await studioRequest<Preview>(`${base}/preview`);
        setPreview(next); setFocusRequest(undefined);
        setNotice(videoWarnings.length ? `Aura suara video belum siap: ${videoWarnings.join(", ")}. Video tetap dapat diputar. Tekan Muat ulang pratinjau untuk mencoba analisis lagi.` : "Aura latar mengikuti soundtrack. Aura depan mengikuti musik section atau suara video aktif.");
      } else if (dirty) await persist();
      setActiveStep(step);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Perubahan belum tersimpan."); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (locked || problems.length) { if (problems.length) setError(problems[0]); return; }
    setBusy(true); setError("");
    try { await persist(true); router.push(`/rooms/${encodeURIComponent(roomId)}/bake`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Cerita belum siap diterbitkan."); setBusy(false); }
  }
  async function saveExit() {
    if (!exitTarget || locked) return;
    setBusy(true); setError("");
    try { await persist(); router.push(exitTarget); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Draf belum tersimpan."); setExitTarget(null); setBusy(false); }
  }
  const musicName = (id?: string) => tracks.find(track => track.id === id)?.name ?? "Pilih musikmu";
  return <div className="story-studio">
    <div ref={heading} className="story-studio__top"><nav className="story-stepper" aria-label="Langkah menyusun cerita">{STEPS.map((step, index) => <button key={step.id} type="button" aria-current={activeStep === step.id ? "step" : undefined} disabled={locked} onClick={() => void navigate(step.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><small>{step.description}</small></div></button>)}</nav><div className="story-save-state"><span>{locked ? "Sedang menyiapkan…" : dirty ? "Ada perubahan belum tersimpan" : "Draf tersimpan"}</span><button type="button" onClick={() => void saveOnly()} disabled={locked || !dirty}>Simpan draf</button></div></div>
    {error ? <p role="alert" className="story-error">{error}</p> : null}{notice ? <p role="status" className="story-notice">{notice}</p> : null}
    <fieldset disabled={locked} className="story-studio__content">
      {activeStep === "media" ? <><div className="story-step-heading"><span className="ui-eyebrow">01 / BAHAN CERITA</span><h2>Momen mana yang ingin kamu ceritakan?</h2><p>Pilih foto dan video untuk {recipientName}. Setelah ini, kamu menentukan tempat dan ceritanya.</p></div><div className="story-selection-bar"><strong>{selectedIds.size} / {media.length} momen dipilih</strong><span>Yang tidak dipilih tetap tersimpan di Room.</span></div><div className="story-moment-grid">{media.map(item => <article key={item.id} className={selectedIds.has(item.id) ? "is-selected" : ""}><button type="button" className="story-moment-preview" onClick={() => setInspected(item)} aria-label={`Lihat ${item.originalFileName}`}><MediaThumbnail item={item} url={previewUrlByMediaId[item.id]} /><span>Lihat media ↗</span></button><label><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleMedia(item)} /><span><strong>{item.originalFileName}</strong><small>{item.type === "video" ? "Video" : "Foto"} · {(item.sizeBytes / 1024 / 1024).toFixed(1)} MB{item.contributorName ? ` · ${item.contributorName}` : ""}</small></span></label></article>)}</div>{!media.length ? <p>Belum ada media. Kamu tetap bisa memulai dengan section Teks.</p> : null}</> : null}
      {activeStep === "arrange" ? <><div className="story-step-heading"><span className="ui-eyebrow">02 / SUSUNAN MILIKMU</span><h2>Setiap momen punya tempat.</h2><p>Buat section, isi momennya, lalu ceritakan dengan bahasamu sendiri.</p></div><SectionEditor sections={draft.sectionPlan} settings={draft.selectedMedia} media={media} urls={previewUrlByMediaId} onChange={sectionsChanged} onSetting={(id, patch) => update({ selectedMedia: draft.selectedMedia.map(setting => setting.mediaId === id ? { ...setting, ...patch } : setting) })} onRecommend={() => draft.sectionPlan.length ? setReplaceOpen(true) : recommend()} /></> : null}
      {activeStep === "music" ? <><div className="story-step-heading"><span className="ui-eyebrow">03 / SUARA CERITA</span><h2>Musik yang terasa milik kalian.</h2><p>Satu lagu menemani perjalanan. Lagu tambahan bisa memberi warna pada section tertentu. Keduanya opsional.</p></div><div className="story-soundtrack"><div><span className="ui-eyebrow">MUSIK SOUNDTRACK · AURA BACKGROUND</span><h3>{draft.backgroundMusic ? musicName(draft.backgroundMusic.musicId) : "Pengiring sepanjang cerita"}</h3><p>Terus berjalan saat berpindah section. Suaranya mengecil ketika musik section atau suara video terdengar.</p>{draft.backgroundMusic ? <MusicVolume label="Volume soundtrack" value={draft.backgroundMusic.volume ?? 1} onChange={volume => update({ backgroundMusic: { ...draft.backgroundMusic!, volume } })} /> : null}</div><div className="story-track-actions"><button type="button" className="ui-button ui-button--primary" onClick={() => setMusicTarget("background")}>{draft.backgroundMusic ? "Ganti soundtrack" : "Tambahkan soundtrack"}</button>{draft.backgroundMusic ? <button type="button" onClick={() => update({ backgroundMusic: null })}>Lepaskan</button> : null}</div></div><div className="story-section-music"><div className="story-step-heading"><span className="ui-eyebrow">MUSIK SECTION · AURA FOREGROUND</span><h3>Sorotan untuk bagian tertentu.</h3><p>Hanya musik section yang sedang dilihat yang berbunyi. Ketika kembali, lagunya mulai dari awal. Jika lagunya sama dengan soundtrack, satu pemutaran diteruskan dengan volume section selama bagian itu aktif.</p></div>{draft.sectionPlan.map((section, index) => <article key={section.id}><span className="story-section__number">{String(index + 1).padStart(2, "0")}</span><div><strong>{sectionLabel(section, index)}</strong><small>{section.music ? musicName(section.music.musicId) : "Mengikuti soundtrack latar"}</small>{section.music ? <MusicVolume label={`Volume ${sectionLabel(section, index)}`} value={section.music.volume ?? 1} onChange={volume => patchSection(section.id, { music: { ...section.music!, volume } })} /> : null}</div>{section.music ? <div className="story-track-actions"><button type="button" onClick={() => setMusicTarget(section.id)}>Ganti musik</button><button type="button" onClick={() => patchSection(section.id, { music: null })}>Matikan</button></div> : <button type="button" onClick={() => setMusicTarget(section.id)}>Nyalakan Musik section</button>}</article>)}</div><p className="story-help">Suara asli video tetap mendapat ruang. Aura mengikuti beat atau energi tanpa kilatan strobe, dan teks tetap mudah dibaca.</p></> : null}
      {activeStep === "preview" ? <><div className="story-step-heading"><span className="ui-eyebrow">04 / PRATINJAU & SUASANA</span><h2>Rasakan cerita sebelum dibagikan.</h2><p>Putar, gulir, dan coba slidernya. Inilah tampilan yang akan dibuka penerima.</p></div><div className="story-preview-layout"><div className="story-preview-stage" ref={previewStage}>{preview ? <ReceiverExperience key={preview.manifest.revision} manifest={preview.manifest} previewAssetUrls={preview.assetUrls} focusRequest={focusRequest} /> : <div className="story-empty"><p>Siapkan pratinjau untuk melihat cerita lengkap.</p></div>}{dirty ? <div className="story-preview-update"><span>Ada perubahan suasana. Terapkan untuk melihat hasilnya.</span><button type="button" className="ui-button ui-button--primary" onClick={() => void navigate("preview")}>Terapkan & putar ulang</button></div> : null}</div><aside className="story-preview-settings"><h3>Suasana keseluruhan</h3><label>Tema ruang<select value={draft.themeId} onChange={event => update({ themeId: event.target.value as Draft["themeId"] })}>{curatedThemes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><AtmosphereControls value={draft.atmosphere} onChange={atmosphere => update({ atmosphere })} /><details open className="story-final-order"><summary>Urutan ceritamu · {draft.sectionPlan.length}</summary><p>Ketuk nomor untuk menuju section. Buka pengaturan untuk suasana khusus.</p>{draft.sectionPlan.map((section, index) => <div key={section.id}><button type="button" aria-label={`Pratinjau ${sectionLabel(section, index)}`} onClick={() => focusSection(section.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{sectionLabel(section, index)}</strong></button><button type="button" onClick={() => setEditingAtmosphere(section.id)} aria-label={`Suasana ${sectionLabel(section, index)}`}>{section.atmosphere ? "Khusus" : "Atur"}</button></div>)}{preview?.manifest.wishes.length ? <p>{preview.manifest.wishes.length} ucapan ditampilkan bersama di akhir cerita.</p> : null}</details><button type="button" onClick={() => void navigate("arrange")}>← Ubah susunan & keterangan</button><button type="button" onClick={() => void navigate("preview")}>Muat ulang pratinjau</button></aside></div>{selectedIds.size > assignedIds.size ? <p className="story-help">{selectedIds.size - assignedIds.size} momen belum ditempatkan. Hanya media di dalam section yang ditampilkan kepada penerima; file lainnya tetap tersimpan.</p> : null}</> : null}
    </fieldset>
    <footer className="story-step-footer"><button type="button" className="ui-button ui-button--secondary" disabled={locked} onClick={() => { if (activeIndex > 0) void navigate(STEPS[activeIndex - 1].id); else if (dirty) setExitTarget(`/rooms/${roomId}`); else router.push(`/rooms/${roomId}`); }}>{activeIndex ? `← ${STEPS[activeIndex - 1].label}` : "← Kembali ke Room"}</button><span>Langkah {activeIndex + 1} dari 4</span><button type="button" className="ui-button ui-button--primary" disabled={locked} onClick={() => activeStep === "preview" ? void publish() : void navigate(STEPS[activeIndex + 1].id)}>{busy ? "Menyiapkan…" : activeStep === "preview" ? "Lanjut terbitkan →" : `Lanjut ke ${STEPS[activeIndex + 1].label} →`}</button></footer>
    <Dialog open={musicTarget !== null} onClose={() => { if (!musicBusy) setMusicTarget(null); }} busy={musicBusy} title={musicTarget === "background" ? "Musik Soundtrack" : `Musik · ${musicSection ? sectionLabel(musicSection, draft.sectionPlan.indexOf(musicSection)) : "Section"}`} className="story-music-dialog"><MusicLibrary roomId={roomId} tracks={tracks} selected={musicTarget === "background" ? draft.backgroundMusic : musicSection?.music ?? null} onTracks={setTracks} onBusy={setMusicBusy} onSelect={selection => { const volume = (musicTarget === "background" ? draft.backgroundMusic : musicSection?.music)?.volume ?? 1; const music = selection ? { ...selection, volume } : null; if (musicTarget === "background") update({ backgroundMusic: music }); else if (musicTarget) patchSection(musicTarget, { music }); setMusicTarget(null); }} /></Dialog>
    <Dialog open={Boolean(atmosphereSection)} onClose={() => setEditingAtmosphere(null)} title={`Suasana · ${atmosphereSection ? sectionLabel(atmosphereSection, draft.sectionPlan.indexOf(atmosphereSection)) : "Section"}`} className="story-atmosphere-dialog">{atmosphereSection ? <><label className="story-check"><input type="checkbox" checked={Boolean(atmosphereSection.atmosphere)} onChange={event => patchSection(atmosphereSection.id, { atmosphere: event.target.checked ? { ...draft.atmosphere } : null })} />Gunakan suasana khusus untuk section ini</label>{atmosphereSection.atmosphere ? <AtmosphereControls section value={atmosphereSection.atmosphere} onChange={atmosphere => patchSection(atmosphereSection.id, { atmosphere })} /> : <p>Section mengikuti suasana keseluruhan{atmosphereSection.emphasis ? ", dengan sedikit penekanan" : ""}.</p>}<button type="button" className="ui-button ui-button--primary" onClick={() => setEditingAtmosphere(null)}>Selesai</button></> : null}</Dialog>
    <MediaInspection item={inspected} url={inspected ? previewUrlByMediaId[inspected.id] : undefined} onClose={() => setInspected(null)} />
    <Dialog open={Boolean(removeMedia)} onClose={() => setRemoveMedia(null)} title="Lepaskan momen dari cerita?"><p>Media ini juga dilepas dari semua slot section. Keterangan dan file aslinya tetap tersimpan.</p><div className="journey-dialog__actions"><button type="button" onClick={() => setRemoveMedia(null)}>Batal</button><button type="button" className="ui-button ui-button--primary" onClick={() => { if (removeMedia) removeSelected(removeMedia); }}>Lepaskan dari cerita</button></div></Dialog>
    <Dialog open={replaceOpen} onClose={() => setReplaceOpen(false)} title="Buat ulang rekomendasi susunan?"><p>Section, keterangan, dan pasangan musik yang sedang kamu susun akan diganti. Media dan file musik tetap aman di Room.</p><div className="journey-dialog__actions"><button type="button" onClick={() => setReplaceOpen(false)}>Pertahankan susunan</button><button type="button" className="ui-button ui-button--primary" onClick={recommend}>Buat rekomendasi baru</button></div></Dialog>
    <Dialog open={Boolean(exitTarget)} onClose={() => setExitTarget(null)} busy={busy} title="Simpan ceritamu sebelum keluar?"><p>Draf dapat disimpan meskipun beberapa slot belum terisi.</p><div className="journey-dialog__actions"><button type="button" onClick={() => setExitTarget(null)} disabled={busy}>Tetap di sini</button><button type="button" className="ui-button ui-button--primary" onClick={() => void saveExit()} disabled={busy}>{busy ? "Menyimpan…" : "Simpan & keluar"}</button></div></Dialog>
  </div>;
}
