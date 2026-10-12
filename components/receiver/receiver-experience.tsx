"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { ReceiverManifest, ReceiverMediaDescriptor, ReceiverWish } from "@/lib/data/contracts";
import { defaultSceneAtmosphere, type ExperienceSection } from "@/lib/studio/contracts";
import { fetchAndCacheResource } from "@/lib/browser-cache/cache";
import { useStoryAudio } from "./use-story-audio";
import { useSectionNavigation } from "./use-section-navigation";
import { activeForegroundVolume } from "@/lib/receiver/playback";
import dynamic from "next/dynamic";
import { AURA_RENDERER_VERSION, mediaFraming } from "@/lib/receiver/aura-state";

import { useAuraPlayback, type ActiveVideoAudio } from "./use-aura-playback";

const AuraEnvironment = dynamic(() => import("./aura-environment"), { ssr: false });

const PreviewAssets = createContext<Record<string, string> | undefined>(undefined);

function assetUrl(manifest: ReceiverManifest, id: string, preview?: Record<string, string>) {
  if (preview?.[id]) return preview[id];
  const asset = manifest.assets.find(item => item.id === id);
  return asset?.delivery === "public" && asset.publicPath ? asset.publicPath : `/api/receiver/${encodeURIComponent(manifest.receiverId)}/assets/${encodeURIComponent(id)}?v=${manifest.revision}`;
}
function greeting(occasion: string, name: string) {
  if (occasion.includes("birth")) return `Selamat ulang tahun, ${name}`;
  if (occasion.includes("gradu")) return `Selamat atas pencapaianmu, ${name}`;
  if (occasion.includes("anniv")) return `Selamat hari jadi, ${name}`;
  return `Untukmu, ${name}`;
}

function MemoryPhoto({ item, manifest, fit }: { item: ReceiverMediaDescriptor; manifest: ReceiverManifest; fit: "cover" | "contain" }) {
  const preview = useContext(PreviewAssets);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const sourceUrl = assetUrl(manifest, item.assetId, preview);
    const request = preview ? fetch(sourceUrl).then(response => ({ response })) : fetchAndCacheResource({ cacheKey: `${manifest.receiverId}/r${manifest.revision}/${item.assetId}`, sourceUrl, kind: "photo", resourceId: item.id, roomId: manifest.room.id, version: manifest.revision });
    void request
      .then(async result => {
        const blob = await result.response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      }).catch(() => { if (!cancelled) setSource(assetUrl(manifest, item.assetId, preview)); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item, manifest, attempt, preview]);
  if (failed) return <div className="receiver-asset-error" role="status"><p>Foto belum dapat dimuat.</p><button onClick={() => { setFailed(false); setSource(null); setAttempt(value => value + 1); }}>Coba lagi</button></div>;
  return source ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="is-visible" alt={item.contributorName ? `Kenangan dari ${item.contributorName}` : item.originalFileName} src={source} style={{ objectFit: fit }} onError={() => setFailed(true)} />
  ) : <div className="receiver-asset-error" role="status">Memuat kenangan…</div>;
}

function PhotoAlbum({ items, section, active, motion, manifest }: { items: ReceiverMediaDescriptor[]; section: ExperienceSection; active: boolean; motion: boolean; manifest: ReceiverManifest }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!active || !motion || paused || items.length < 2) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % items.length), Math.min(8000, Math.max(2500, section.dwellSeconds * 1000)));
    return () => window.clearInterval(timer);
  }, [active, motion, paused, items.length, section.dwellSeconds]);
  const item = items[index];
  if (!item) return null;
  return <div className="receiver-album"><div className="receiver-photo-stack"><MemoryPhoto key={item.id} item={item} manifest={manifest} fit={section.mediaTreatment.find(setting => setting.mediaId === item.id)?.fit ?? "contain"} /></div>
    {items.length > 1 ? <div className="receiver-album-controls"><button aria-label="Foto sebelumnya" onClick={() => { setPaused(true); setIndex(value => (value - 1 + items.length) % items.length); }}>←</button><span aria-live="polite">{index + 1} / {items.length}</span><button aria-label="Foto berikutnya" onClick={() => { setPaused(true); setIndex(value => (value + 1) % items.length); }}>→</button><button aria-pressed={!paused && motion} onClick={() => setPaused(value => !value)} disabled={!motion}>{paused || !motion ? "Putar album" : "Jeda album"}</button></div> : null}
  </div>;
}

function MemoryVideo({ item, section, manifest, active, report }: { item: ReceiverMediaDescriptor; section: ExperienceSection; manifest: ReceiverManifest; active: boolean; report: (id: string, volume: number, video?: HTMLVideoElement, mediaId?: string) => void }) {
  const preview = useContext(PreviewAssets);
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const treatment = section.mediaTreatment.find(setting => setting.mediaId === item.id);
  const volume = treatment?.volume ?? 1;
  const start = treatment?.trimInSec ?? 0;
  const end = treatment?.trimOutSec ?? null;
  const loop = Boolean(treatment?.loop);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.volume = volume;
    video.muted = volume <= 0;
    if (!active) { video.pause(); return; }
    if (video.currentTime < start || (end !== null && video.currentTime >= end)) video.currentTime = start;
    void video.play().catch(() => undefined); // Native controls remain available when autoplay is blocked.
    return () => { video.pause(); report(section.id, 0); };
  }, [active, volume, start, end, section.id, report, attempt]);
  function audible(event: SyntheticEvent<HTMLVideoElement>, playing = true) {
    const video = event.currentTarget;
    if (!active && playing) { video.pause(); report(section.id, 0); return; }
    report(section.id, item.audioPresence !== "absent" && active && playing && !video.paused && !video.muted && !video.seeking && !video.ended && video.readyState >= 3 ? video.volume : 0, video, item.id);
  }
  function enforceTrim(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (video.currentTime < start) video.currentTime = start;
    if (end !== null && video.currentTime >= end) {
      if (loop) { video.currentTime = start; void video.play().catch(() => undefined); }
      else { video.pause(); video.currentTime = end; }
    }
  }
  return <div className="receiver-video-frame">
    {failed ? <div className="receiver-asset-error" role="status"><p>Video belum dapat diputar. Cerita lainnya tetap bisa dibuka.</p><button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Coba lagi</button></div> : <video key={attempt} ref={ref} controls playsInline preload="metadata" src={assetUrl(manifest, item.assetId, preview)} style={{ objectFit: treatment?.fit ?? "contain" }} onLoadedMetadata={event => { event.currentTarget.currentTime = start; }} onTimeUpdate={enforceTrim} onPlaying={event => audible(event)} onPause={event => audible(event, false)} onWaiting={event => audible(event, false)} onVolumeChange={event => audible(event)} onSeeking={event => audible(event, false)} onSeeked={event => { enforceTrim(event); audible(event); }} onEnded={event => { audible(event, false); if (loop && active) { event.currentTarget.currentTime = start; void event.currentTarget.play().catch(() => undefined); } }} onError={() => { setFailed(true); report(section.id, 0); }} />}
    <span className="receiver-media-credit">{item.contributorName ? `dari ${item.contributorName}` : "Kenangan pilihan"}</span>
  </div>;
}

function VideoSlider({ items, section, manifest, active, report }: { items: ReceiverMediaDescriptor[]; section: ExperienceSection; manifest: ReceiverManifest; active: boolean; report: (id: string, volume: number, video?: HTMLVideoElement, mediaId?: string) => void }) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  if (!item) return null;
  return <div className="receiver-album"><MemoryVideo key={item.id} item={item} section={section} manifest={manifest} active={active} report={report} />{items.length > 1 ? <div className="receiver-album-controls"><button aria-label="Video sebelumnya" onClick={() => setIndex(value => (value - 1 + items.length) % items.length)}>←</button><span aria-live="polite">{index + 1} / {items.length}</span><button aria-label="Video berikutnya" onClick={() => setIndex(value => (value + 1) % items.length)}>→</button></div> : null}</div>;
}

type ReceiverProps = { manifest: ReceiverManifest; previewAssetUrls?: Record<string, string>; embedded?: boolean; focusRequest?: { id: string; serial: number } };
export function ReceiverExperience(props: ReceiverProps) {
  return <PreviewAssets.Provider value={props.previewAssetUrls}><ExperiencePlayer {...props} /></PreviewAssets.Provider>;
}
function ExperiencePlayer({ manifest, previewAssetUrls, embedded, focusRequest }: ReceiverProps) {
  const preview = Boolean(previewAssetUrls);
  const spatial = (manifest.experience.rendererVersion === AURA_RENDERER_VERSION || manifest.experience.rendererVersion === "ruang-cahaya-v1");
  const rootRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [motion, setMotion] = useState(false);
  const [foreground, setForeground] = useState<ActiveVideoAudio | null>(null);
  const handledFocus = useRef<ReceiverProps["focusRequest"]>(undefined);
  const [wish, setWish] = useState<ReceiverWish | null>(null);
  const mediaById = useMemo(() => new Map(manifest.media.map(item => [item.id, item])), [manifest.media]);
  const sections = manifest.experience.sections;
  const total = sections.length + (manifest.wishes.length ? 1 : 0);
  const { scrollerRef, activeIndex, settled, go, onKeyDown } = useSectionNavigation(started, motion, total);
  const current = sections[activeIndex];
  const mix = manifest.experience.backgroundMusicMix;
  const roomAtmosphere = manifest.experience.atmosphere ?? defaultSceneAtmosphere;
  const atmosphere = current?.atmosphere ?? manifest.experience.atmosphere ?? defaultSceneAtmosphere;
  const sectionTrack = current?.music ? manifest.sectionMusic?.[current.music.musicId] : undefined;
  const sharedTrack = Boolean(sectionTrack && sectionTrack.trackAssetId === manifest.music?.trackAssetId);
  const url = (id: string) => assetUrl(manifest, id, previewAssetUrls);
  const foregroundVolume = settled ? activeForegroundVolume(foreground, current?.id) : 0;
  const sectionVolume = current?.music?.volume ?? 1;
  const backgroundVolume = sharedTrack && settled ? sectionVolume : manifest.experience.backgroundMusic?.volume ?? 1;
  const { backgroundRef: backgroundAudioRef, sectionRef: sectionAudioRef, enabled: musicEnabled, audible: musicAudible, error: musicError, enable: enableMusic, pause: pauseMusic, sectionPlaying: sectionMusicPlaying, backgroundPlaying: backgroundMusicPlaying, backgroundEvents, sectionEvents, gains } = useStoryAudio({
    backgroundUrl: manifest.music ? url(manifest.music.trackAssetId) : undefined,
    sectionUrl: settled && sectionTrack && !sharedTrack ? url(sectionTrack.trackAssetId) : undefined, sectionId: current?.id,
    backgroundVolume, sectionVolume, mix, videoVolume: foregroundVolume, muteMusic: current?.audioMix.mode === "music-muted" && foregroundVolume > 0,
  });
  const hasMusic = Boolean(manifest.music || Object.keys(manifest.sectionMusic ?? {}).length);
  const auraRunning = motion && (musicAudible || foregroundVolume > 0);
  const auraSignals = useAuraPlayback({ manifest, previewUrls: previewAssetUrls, activeIndex, started, settled, motion, background: backgroundAudioRef, section: sectionAudioRef, sharedTrack, video: foreground, backgroundPlaying: backgroundMusicPlaying, sectionPlaying: sectionMusicPlaying, gains, roomAtmosphere, atmosphere, root: rootRef, renderedByCanvas: spatial });
  const report = useCallback((id: string, volume: number, video?: HTMLVideoElement, mediaId?: string) => {
    // Retain the paused video's clock so its last Aura frame can remain visible.
    // Leaving the section reports without an element and releases it.
    setForeground(previous => video && mediaId ? previous?.id === id && previous.volume === volume && previous.video === video ? previous : { id, volume, video, mediaId } : previous?.id === id ? null : previous);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!focusRequest || !preview || handledFocus.current === focusRequest) return;
    const index = sections.findIndex(section => section.id === focusRequest.id);
    if (index < 0) return;
    const frame = requestAnimationFrame(() => {
      if (!started) { setStarted(true); return; }
      // Navigation can run only after the scroller has mounted and initialized.
      handledFocus.current = focusRequest;
      go(index);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, sections, preview, go, started]);
  useEffect(() => {
    if (!started || preview) return;
    let viewer: string;
    try { viewer = localStorage.getItem("kenangin-viewer") || crypto.randomUUID(); localStorage.setItem("kenangin-viewer", viewer); }
    catch { viewer = crypto.randomUUID(); }
    const send = (type: "open" | "watch_threshold") => { void fetch(`/api/receiver/${encodeURIComponent(manifest.receiverId)}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ viewer, type }), keepalive: true }).catch(() => undefined); };
    send("open");
    let visibleSeconds = 0;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++visibleSeconds >= 10) { send("watch_threshold"); window.clearInterval(interval); }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [manifest.receiverId, started, preview]);
  useEffect(() => {
    const visibility = () => { if (document.visibilityState === "hidden") scrollerRef.current?.querySelectorAll("video").forEach(video => video.pause()); };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [scrollerRef]);
  const style = {
    "--receiver-bg": manifest.theme.palette.background, "--receiver-surface": manifest.theme.palette.surface,
    "--receiver-primary": manifest.theme.palette.primary, "--receiver-accent": manifest.theme.palette.accent,
    "--receiver-text": manifest.theme.palette.text, "--receiver-muted": manifest.theme.palette.muted,
    "--receiver-display-font": manifest.theme.typography.displayFamily, "--receiver-body-font": manifest.theme.typography.bodyFamily,
    "--receiver-background-image": `url("${url(manifest.theme.backgroundAssetId)}")`,
  } as CSSProperties;
  return <main className={`receiver-experience ${spatial ? "receiver-spatial" : ""} ${(embedded ?? preview) ? "receiver-experience--embedded" : ""}`} data-world={atmosphere.world ?? "rain"} data-background-world={roomAtmosphere.backgroundWorld ?? roomAtmosphere.world ?? "rain"} data-renderer-version={spatial ? AURA_RENDERER_VERSION : "legacy"} data-opened={started} data-reading={current?.type === "text" || !current} data-motion={motion ? "on" : "off"} data-aura-motion={auraRunning ? "on" : "off"} data-focused-section={current?.id ?? "wishes"} data-playback-ready={started && settled} data-background-aura={roomAtmosphere.backgroundAura ? "on" : "off"} style={style} ref={rootRef}>
    <audio data-audio-layer="background" crossOrigin="anonymous" loop preload="none" ref={backgroundAudioRef} {...backgroundEvents} />
    <audio data-audio-layer="section" crossOrigin="anonymous" loop preload="none" ref={sectionAudioRef} {...sectionEvents} />
    {spatial ? <AuraEnvironment root={rootRef} world={atmosphere.world ?? "rain"} backgroundWorld={roomAtmosphere.backgroundWorld ?? roomAtmosphere.world ?? "rain"} sharpAccents={atmosphere.sharpAccents ?? false} signals={auraSignals} motion={motion} playing={musicAudible || foregroundVolume > 0} opened={started} index={activeIndex} reading={current?.type === "text" || !current} emphasis={settled && current?.role === "emotional_peak"} intensity={{ calm: .28, balanced: .55, lively: 1 }[atmosphere.intensity]} background={roomAtmosphere.backgroundAura} primary={manifest.theme.palette.primary} accent={manifest.theme.palette.accent} /> : <><div className="receiver-theme-background" aria-hidden="true" /><div className="receiver-background-aura" aria-hidden="true" /></>}
    {!spatial && <div className="receiver-theme-decorations" aria-hidden="true">{manifest.theme.decorations.map(item => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={item.id} alt="" src={url(item.assetId)} style={{ left: `${item.anchorX}%`, top: `${item.anchorY}%`, opacity: item.opacity, transform: `translate(-50%, -50%) scale(${item.scale})` }} />
    ))}</div>}
    {!started ? <div className="receiver-opening"><span className="receiver-opening__mark" aria-hidden="true">✦</span><p className="ui-eyebrow">SESUATU YANG DIBUAT KHUSUS</p><h1>Untuk {manifest.room.recipientName}.</h1><p>Ada cerita, tawa, dan ucapan yang menunggumu di sini.</p><button onClick={() => { setStarted(true); if (hasMusic) enableMusic(); }}>Buka kejutan <span aria-hidden="true">→</span></button><small>{hasMusic ? "Musik akan diputar. Nikmati dengan suara yang nyaman." : "Gulir sesukamu. Setiap momen punya ceritanya."}</small></div> : <>
      <div className="receiver-toolbar"><button className="receiver-wordmark" onClick={() => go(0)} aria-label="Kenangin.id — kembali ke awal"><BrandLogo /></button><div>{hasMusic ? <button onClick={() => { if (musicEnabled && !musicError) pauseMusic(); else enableMusic(); }} aria-pressed={musicEnabled}>{musicError ? "♪ Coba musik" : musicEnabled ? "♫ Musik aktif" : "♪ Musik dijeda"}</button> : null}<button onClick={() => setMotion(value => !value)} aria-pressed={motion}>{motion ? "Jeda gerakan" : "Aktifkan gerakan"}</button></div></div>
      {musicError ? <p className="receiver-audio-notice" role="status">Ada musik yang belum dapat diputar. Tekan Coba musik; cerita tetap bisa dinikmati.</p> : null}
      <div className="receiver-scroller" ref={scrollerRef} aria-label="Cerita kenangan" onKeyDown={onKeyDown} tabIndex={0}>
        {sections.map((section, index) => {
          const active = settled && index === activeIndex, adjacent = Math.abs(index - activeIndex) <= 1;
          const items = section.mediaIds.map(id => mediaById.get(id)).filter((item): item is ReceiverMediaDescriptor => Boolean(item));
          const sectionAtmosphere = section.atmosphere ?? manifest.experience.atmosphere;
          return <section className={`receiver-slide receiver-slide--${section.type} ${active ? "is-active" : ""}`} key={section.id} data-receiver-slide data-section-id={section.id} data-framing={mediaFraming(section.type, items[0]?.width, items[0]?.height)} inert={index !== activeIndex} data-aura={section.auraIds.join(" ")} data-transition={sectionAtmosphere ? sectionAtmosphere.motion : section.transitionInId} aria-label={section.title || `Bagian ${index + 1} dari ${total}`} tabIndex={-1}>
            {spatial && <div className="receiver-scene-label" aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span><span>{section.title || "Sebuah kenangan"}</span></div>}
            <div className="receiver-section-aura" aria-hidden="true" />
            <div className="receiver-focus-card" data-section-content tabIndex={0} aria-label="Isi section">{section.type === "hero" ? <div className="receiver-hero-card"><span className="receiver-gift-mark" aria-hidden="true">✦</span><h2>{greeting(manifest.room.occasionId, manifest.room.recipientName)}</h2><p>{section.microCopy ?? "Sebuah ruang kecil untuk kenangan yang dibuat bersama."}</p><button className="receiver-inline-next" onClick={() => go(Math.min(total - 1, index + 1))}>Lihat ceritanya ↓</button></div> : section.type === "text" ? <div className="receiver-text-card">{section.title ? <p className="ui-eyebrow">{section.title}</p> : null}<p className="receiver-text-card__body">{section.microCopy}</p></div> : <>
              {adjacent ? section.type === "photo-slide" || section.type === "photo" ? <PhotoAlbum items={items} section={section} active={active} motion={motion} manifest={manifest} /> : section.type === "video-slide" ? <VideoSlider items={items} section={section} manifest={manifest} active={active} report={report} /> : items[0] ? <MemoryVideo item={items[0]} section={section} manifest={manifest} active={active} report={report} /> : null : <div className="receiver-media-placeholder" />}
              {section.microCopy ? <div className="receiver-section-copy"><p>{section.microCopy}</p></div> : null}</>}
              {section.wishIds.length > 0 ? <button className="receiver-wish-link" onClick={() => { const selected = manifest.wishes.find(item => item.id === section.wishIds[0]); if (selected) setWish(selected); }}>Ada ucapan untukmu ↗</button> : null}
            </div>
          </section>;
        })}
        {manifest.wishes.length > 0 ? <section className={`receiver-slide receiver-slide--wishes ${activeIndex === total - 1 ? "is-active" : ""}`} data-receiver-slide inert={activeIndex !== total - 1} tabIndex={-1} aria-label="Semua ucapan"><div className="receiver-letterbook" data-section-content tabIndex={0} aria-label="Daftar ucapan"><p className="ui-eyebrow">DARI HATI MEREKA</p><h2>Banyak cara untuk bilang,<br />kamu berarti.</h2><p>{manifest.wishes.length} ucapan untuk {manifest.room.recipientName}. Pilih untuk membaca.</p><div className="receiver-letter-list">{manifest.wishes.map((item, index) => <button key={item.id} onClick={() => setWish(item)}><span className="receiver-letter-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{item.contributorName || "Seseorang yang peduli"}</strong><span>{item.text}</span></span><span aria-hidden="true">↗</span></button>)}</div></div></section> : null}
      </div>
      <nav className="receiver-navigation" aria-label="Navigasi cerita"><button disabled={activeIndex === 0} onClick={() => go(activeIndex - 1)}>← Kembali</button><div><span aria-live="polite">{activeIndex + 1} / {total}</span><progress max={total} value={activeIndex + 1} aria-label="Kemajuan cerita" /></div><button onClick={() => go(activeIndex === total - 1 ? 0 : activeIndex + 1)}>{activeIndex === total - 1 ? "Dari awal ↺" : "Lanjut →"}</button></nav>
    </>}
    <Dialog open={wish !== null} onClose={() => setWish(null)} title={wish?.contributorName ? `Dari ${wish.contributorName}` : "Ucapan untukmu"} className="receiver-letter-dialog"><p>{wish?.text}</p></Dialog>
  </main>;
}
