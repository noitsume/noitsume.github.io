"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import type { ReceiverManifest, ReceiverMediaDescriptor, ReceiverWish } from "@/lib/data/contracts";
import type { ExperienceSection } from "@/lib/studio/contracts";
import { fetchAndCacheResource } from "@/lib/browser-cache/cache";
import { activeForegroundVolume, beatPulse, energyAt, musicGain } from "@/lib/receiver/playback";

function assetUrl(manifest: ReceiverManifest, id: string) {
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
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void fetchAndCacheResource({ cacheKey: `${manifest.receiverId}/r${manifest.revision}/${item.assetId}`, sourceUrl: assetUrl(manifest, item.assetId), kind: "photo", resourceId: item.id, roomId: manifest.room.id, version: manifest.revision })
      .then(async result => {
        const blob = await result.response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      }).catch(() => { if (!cancelled) setSource(assetUrl(manifest, item.assetId)); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item, manifest, attempt]);
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
    const timer = window.setInterval(() => setIndex(value => (value + 1) % items.length), Math.min(8000, Math.max(2500, section.dwellSeconds * 1000 / items.length)));
    return () => window.clearInterval(timer);
  }, [active, motion, paused, items.length, section.dwellSeconds]);
  const item = items[index];
  if (!item) return null;
  return <div className="receiver-album"><div className="receiver-photo-stack"><MemoryPhoto key={item.id} item={item} manifest={manifest} fit={section.mediaTreatment.find(setting => setting.mediaId === item.id)?.fit ?? "contain"} /></div>
    {items.length > 1 ? <div className="receiver-album-controls"><button aria-label="Foto sebelumnya" onClick={() => { setPaused(true); setIndex(value => (value - 1 + items.length) % items.length); }}>←</button><span aria-live="polite">{index + 1} / {items.length}</span><button aria-label="Foto berikutnya" onClick={() => { setPaused(true); setIndex(value => (value + 1) % items.length); }}>→</button><button aria-pressed={!paused && motion} onClick={() => setPaused(value => !value)} disabled={!motion}>{paused || !motion ? "Putar album" : "Jeda album"}</button></div> : null}
  </div>;
}

function MemoryVideo({ item, section, manifest, active, report }: { item: ReceiverMediaDescriptor; section: ExperienceSection; manifest: ReceiverManifest; active: boolean; report: (id: string, volume: number) => void }) {
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
    report(section.id, item.audioPresence !== "absent" && active && playing && !video.paused && !video.muted ? video.volume : 0);
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
    {failed ? <div className="receiver-asset-error" role="status"><p>Video belum dapat diputar. Cerita lainnya tetap bisa dibuka.</p><button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Coba lagi</button></div> : <video key={attempt} ref={ref} controls playsInline preload="metadata" src={assetUrl(manifest, item.assetId)} style={{ objectFit: treatment?.fit ?? "contain" }} onLoadedMetadata={event => { event.currentTarget.currentTime = start; }} onTimeUpdate={enforceTrim} onPlaying={event => audible(event)} onPause={event => audible(event, false)} onWaiting={event => audible(event, false)} onVolumeChange={event => audible(event)} onSeeking={event => audible(event, false)} onSeeked={event => { enforceTrim(event); audible(event); }} onEnded={event => { audible(event, false); if (loop && active) { event.currentTarget.currentTime = start; void event.currentTarget.play().catch(() => undefined); } }} onError={() => { setFailed(true); report(section.id, 0); }} />}
    <span className="receiver-media-credit">{item.contributorName ? `dari ${item.contributorName}` : "Kenangan pilihan"}</span>
  </div>;
}

export function ReceiverExperience({ manifest }: { manifest: ReceiverManifest }) {
  const rootRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const graph = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const [motion, setMotion] = useState(false);
  const [foreground, setForeground] = useState<{ id: string; volume: number } | null>(null);
  const [wish, setWish] = useState<ReceiverWish | null>(null);
  const beats = useRef({ beats: manifest.music.beats, energy: manifest.music.energyCurve, duration: manifest.music.durationSec ?? 1 });
  const mediaById = useMemo(() => new Map(manifest.media.map(item => [item.id, item])), [manifest.media]);
  const sections = manifest.experience.sections;
  const total = sections.length + (manifest.wishes.length ? 1 : 0);
  const current = sections[activeIndex];
  const mix = manifest.experience.backgroundMusicMix;
  const report = useCallback((id: string, volume: number) => {
    setForeground(previous => volume > 0 ? previous?.id === id && previous.volume === volume ? previous : { id, volume } : previous?.id === id ? null : previous);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!started) return;
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
  }, [manifest.receiverId, started]);
  useEffect(() => {
    if (manifest.music.beatmapSource !== "asset" || !started) return;
    let cancelled = false;
    void fetchAndCacheResource({ cacheKey: `${manifest.receiverId}/r${manifest.revision}/beatmap`, sourceUrl: assetUrl(manifest, manifest.music.beatmapAssetId), kind: "beatmap", resourceId: manifest.music.beatmapAssetId, version: manifest.revision }).then(result => result.response.json()).then(data => {
      if (cancelled) return;
      const values = Array.isArray(data.beats) ? data.beats.filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0).sort((a: number, b: number) => a - b) : [];
      const energy = Array.isArray(data.energyCurve) ? data.energyCurve.filter((value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 1) : [];
      beats.current = { beats: values.slice(0, 5000), energy: energy.slice(0, 600), duration: manifest.music.durationSec ?? 1 };
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [manifest, started]);
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !started) return;
    let frame = 0;
    function measure() {
      frame = 0;
      if (!root) return;
      const center = root.getBoundingClientRect().top + root.clientHeight / 2;
      const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-receiver-slide]"));
      let nearest = 0, distance = Infinity;
      slides.forEach((slide, index) => { const rect = slide.getBoundingClientRect(); const delta = Math.max(rect.top - center, center - rect.bottom, 0); if (delta < distance) { distance = delta; nearest = index; } });
      setActiveIndex(nearest);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    root.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule); schedule();
    return () => { root.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, [started]);
  const foregroundVolume = activeForegroundVolume(foreground, current?.id);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = musicGain(mix.normalGain, mix.duckedGain, mix.maxBackgroundRelativeDb, foregroundVolume, current?.audioMix.mode === "music-muted" && foregroundVolume > 0);
    const seconds = (foregroundVolume > 0 ? mix.duckAttackMs : mix.duckReleaseMs) / 1000;
    const node = graph.current;
    if (node) {
      node.gain.gain.cancelScheduledValues(node.context.currentTime);
      node.gain.gain.setTargetAtTime(target, node.context.currentTime, Math.max(.01, seconds / 3));
      audio.volume = 1;
      return;
    }
    // Standard media volume is a fallback for browsers without Web Audio.
    audio.volume = target;
  }, [mix, foregroundVolume, current?.audioMix.mode, musicPlaying]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !motion || !musicPlaying) { root?.style.setProperty("--beat", "0"); return; }
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      if (now - previous > 32 && document.visibilityState === "visible") {
        previous = now;
        const time = audioRef.current?.currentTime ?? 0;
        const alignment = current?.beatAlignment === "none" ? 0 : current?.beatAlignment === "strong" ? 1 : .4;
        root.style.setProperty("--beat", String(beatPulse(beats.current.beats, time) * alignment));
        root.style.setProperty("--energy", String(energyAt(beats.current.energy, time, beats.current.duration)));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motion, musicPlaying, current?.beatAlignment]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { audioRef.current?.pause(); scrollerRef.current?.querySelectorAll("video").forEach(video => video.pause()); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); void graph.current?.context.close(); };
  }, []);
  async function playMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    setMusicError(false);
    try {
      if (!graph.current && typeof AudioContext !== "undefined") {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = mix.normalGain;
        context.createMediaElementSource(audio).connect(gain).connect(context.destination);
        graph.current = { context, gain };
      }
      if (graph.current?.context.state === "suspended") void graph.current.context.resume();
      await audio.play();
    } catch { setMusicError(true); }
  }
  function go(index: number) {
    const root = scrollerRef.current;
    const slide = root?.querySelectorAll<HTMLElement>("[data-receiver-slide]")[index];
    if (slide && root) { root.scrollTo({ top: slide.offsetTop, behavior: motion ? "smooth" : "instant" }); slide.focus({ preventScroll: true }); }
  }
  const style = {
    "--receiver-bg": manifest.theme.palette.background, "--receiver-surface": manifest.theme.palette.surface,
    "--receiver-primary": manifest.theme.palette.primary, "--receiver-accent": manifest.theme.palette.accent,
    "--receiver-text": manifest.theme.palette.text, "--receiver-muted": manifest.theme.palette.muted,
    "--receiver-display-font": manifest.theme.typography.displayFamily, "--receiver-body-font": manifest.theme.typography.bodyFamily,
    "--receiver-background-image": `url("${assetUrl(manifest, manifest.theme.backgroundAssetId)}")`,
  } as CSSProperties;
  return <main className="receiver-experience" data-motion={motion ? "on" : "off"} style={style} ref={rootRef}>
    <audio crossOrigin="anonymous" loop preload="none" ref={audioRef} src={assetUrl(manifest, manifest.music.trackAssetId)} onPlay={() => setMusicPlaying(true)} onPause={() => setMusicPlaying(false)} onError={() => { setMusicError(true); setMusicPlaying(false); }} />
    <div className="receiver-theme-background" aria-hidden="true" />
    <div className="receiver-theme-decorations" aria-hidden="true">{manifest.theme.decorations.map(item => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={item.id} alt="" src={assetUrl(manifest, item.assetId)} style={{ left: `${item.anchorX}%`, top: `${item.anchorY}%`, opacity: item.opacity, transform: `translate(-50%, -50%) scale(${item.scale})` }} />
    ))}</div>
    {!started ? <div className="receiver-opening"><span className="receiver-opening__mark" aria-hidden="true">✦</span><p className="ui-eyebrow">SESUATU YANG DIBUAT KHUSUS</p><h1>Untuk {manifest.room.recipientName}.</h1><p>Ada cerita, tawa, dan ucapan yang menunggumu di sini.</p><button onClick={() => { setStarted(true); void playMusic(); }}>Buka kejutan <span aria-hidden="true">→</span></button><small>Musik akan diputar. Nikmati dengan suara yang nyaman.</small></div> : <>
      <div className="receiver-toolbar"><a href="#receiver-story" className="receiver-wordmark">kenangin<span> ✦</span></a><div><button onClick={() => { if (musicPlaying) audioRef.current?.pause(); else void playMusic(); }} aria-pressed={musicPlaying}>{musicPlaying ? "♫ Musik aktif" : musicError ? "♪ Coba musik" : "♪ Musik dijeda"}</button><button onClick={() => setMotion(value => !value)} aria-pressed={motion}>{motion ? "Jeda gerakan" : "Aktifkan gerakan"}</button></div></div>
      {musicError ? <p className="receiver-audio-notice" role="status">Musik belum dapat diputar. Kamu tetap bisa menikmati ceritanya.</p> : null}
      <div className="receiver-scroller" id="receiver-story" ref={scrollerRef} aria-label="Cerita kenangan" onKeyDown={event => { if (event.target !== event.currentTarget && !(event.target instanceof HTMLElement && event.target.matches("[data-receiver-slide]"))) return; if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); go(Math.min(total - 1, activeIndex + 1)); } if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); go(Math.max(0, activeIndex - 1)); } }} tabIndex={0}>
        {sections.map((section, index) => {
          const active = index === activeIndex;
          const adjacent = Math.abs(index - activeIndex) <= 1;
          const items = section.mediaIds.map(id => mediaById.get(id)).filter((item): item is ReceiverMediaDescriptor => Boolean(item));
          return <section className={`receiver-slide receiver-slide--${section.type} ${active ? "is-active" : ""}`} key={section.id} data-receiver-slide data-aura={section.auraIds.join(" ")} data-transition={section.transitionInId} aria-label={`Bagian ${index + 1} dari ${total}`} tabIndex={-1}>
            <div className="receiver-section-aura" aria-hidden="true" />
            <div className="receiver-focus-card">{section.type === "hero" ? <div className="receiver-hero-card"><span className="receiver-gift-mark" aria-hidden="true">✦</span><h2>{greeting(manifest.room.occasionId, manifest.room.recipientName)}</h2><p>{section.microCopy ?? "Sebuah ruang kecil untuk kenangan yang dibuat bersama."}</p><button className="receiver-inline-next" onClick={() => go(Math.min(total - 1, index + 1))}>Lihat ceritanya ↓</button></div> : <>{adjacent ? section.type === "photo-slide" ? <PhotoAlbum items={items} section={section} active={active} motion={motion} manifest={manifest} /> : items[0] ? <MemoryVideo item={items[0]} section={section} manifest={manifest} active={active} report={report} /> : null : <div className="receiver-media-placeholder" />}{section.microCopy ? <div className="receiver-section-copy"><p>{section.microCopy}</p></div> : null}</>}
              {section.wishIds.length > 0 ? <button className="receiver-wish-link" onClick={() => { const selected = manifest.wishes.find(item => item.id === section.wishIds[0]); if (selected) setWish(selected); }}>Ada ucapan untukmu ↗</button> : null}
            </div>
          </section>;
        })}
        {manifest.wishes.length > 0 ? <section className={`receiver-slide receiver-slide--wishes ${activeIndex === total - 1 ? "is-active" : ""}`} data-receiver-slide tabIndex={-1} aria-label="Semua ucapan"><div className="receiver-letterbook"><p className="ui-eyebrow">DARI HATI MEREKA</p><h2>Banyak cara untuk bilang,<br />kamu berarti.</h2><p>{manifest.wishes.length} ucapan untuk {manifest.room.recipientName}. Pilih untuk membaca.</p><div className="receiver-letter-list">{manifest.wishes.map((item, index) => <button key={item.id} onClick={() => setWish(item)}><span className="receiver-letter-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{item.contributorName || "Seseorang yang peduli"}</strong><span>{item.text}</span></span><span aria-hidden="true">↗</span></button>)}</div></div></section> : null}
      </div>
      <nav className="receiver-navigation" aria-label="Navigasi cerita"><button disabled={activeIndex === 0} onClick={() => go(activeIndex - 1)}>← Kembali</button><div><span aria-live="polite">{activeIndex + 1} / {total}</span><progress max={total} value={activeIndex + 1} aria-label="Kemajuan cerita" /></div><button onClick={() => go(activeIndex === total - 1 ? 0 : activeIndex + 1)}>{activeIndex === total - 1 ? "Dari awal ↺" : "Lanjut →"}</button></nav>
    </>}
    <Dialog open={wish !== null} onClose={() => setWish(null)} title={wish?.contributorName ? `Dari ${wish.contributorName}` : "Ucapan untukmu"} className="receiver-letter-dialog"><p>{wish?.text}</p></Dialog>
  </main>;
}
