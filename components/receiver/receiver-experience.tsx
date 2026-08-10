"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { ChevronDownIcon, VideoIcon } from "@/components/ui";
import type {
  ReceiverManifest,
  ReceiverMediaDescriptor,
  ReceiverWish,
} from "@/lib/data/contracts";
import type { ExperienceSection } from "@/lib/studio/contracts";

function receiverAssetUrl(receiverId: string, assetId: string) {
  return `/api/receiver/${encodeURIComponent(receiverId)}/assets/${encodeURIComponent(assetId)}`;
}

function greetingFor(occasionId: string, recipientName: string) {
  const occasion = occasionId.toLowerCase();
  if (occasion.includes("birth")) return `Selamat ulang tahun, ${recipientName}`;
  if (occasion.includes("gradu")) return `Selamat atas pencapaianmu, ${recipientName}`;
  if (occasion.includes("anniv")) return `Selamat hari jadi, ${recipientName}`;
  return `Selamat untuk momen spesialmu, ${recipientName}`;
}

function sectionWishes(section: ExperienceSection, wishesById: Map<string, ReceiverWish>) {
  return section.wishIds
    .map((id) => wishesById.get(id))
    .filter((item): item is ReceiverWish => Boolean(item));
}

function PhotoSlide({
  active,
  items,
  receiverId,
}: {
  active: boolean;
  items: ReceiverMediaDescriptor[];
  receiverId: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || items.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [active, items.length]);

  return (
    <div className="receiver-photo-stack">
      {items.map((item, itemIndex) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={item.originalFileName}
          className={itemIndex === index ? "is-visible" : ""}
          key={item.id}
          loading={itemIndex === 0 ? "eager" : "lazy"}
          src={receiverAssetUrl(receiverId, item.assetId)}
        />
      ))}
      {items.length > 1 ? <span className="receiver-photo-stack__counter">{index + 1}/{items.length}</span> : null}
    </div>
  );
}

function WishCloud({ active, wishes }: { active: boolean; wishes: ReceiverWish[] }) {
  return (
    <div className={`receiver-wish-cloud ${active ? "is-active" : ""}`}>
      {wishes.slice(0, 12).map((wish, index) => (
        <div
          className="receiver-wish"
          key={wish.id}
          style={{
            "--wish-delay": `${index * 110}ms`,
            "--wish-x": `${[10, 58, 18, 55, 36, 8, 62, 28, 70, 43, 15, 52][index % 12]}%`,
            "--wish-y": `${[14, 25, 48, 62, 38, 72, 78, 18, 51, 82, 33, 68][index % 12]}%`,
          } as CSSProperties}
        >
          <span>{wish.text}</span>
          {wish.contributorName ? <small>— {wish.contributorName}</small> : null}
        </div>
      ))}
    </div>
  );
}


function ReceiverVideo({
  active,
  assetUrl,
  fit,
  loop,
  volume,
  trimInSec,
  trimOutSec,
}: {
  active: boolean;
  assetUrl: string;
  fit: "cover" | "contain";
  loop: boolean;
  volume: number;
  trimInSec: number | null;
  trimOutSec: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trimStart = trimInSec ?? 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, volume));
    video.muted = volume <= 0;
    if (!active) {
      video.pause();
      return;
    }
    if (video.currentTime < trimStart || (trimOutSec !== null && video.currentTime >= trimOutSec)) {
      video.currentTime = trimStart;
    }
    void video.play().catch(() => undefined);
  }, [active, trimOutSec, trimStart, volume]);

  function enforceTrim(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (trimOutSec === null || video.currentTime < trimOutSec) return;
    if (loop) {
      video.currentTime = trimStart;
      void video.play().catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = trimOutSec;
    }
  }

  return (
    <video
      controls
      onLoadedMetadata={(event) => { if (trimStart > 0) event.currentTarget.currentTime = trimStart; }}
      onTimeUpdate={enforceTrim}
      playsInline
      preload="metadata"
      ref={videoRef}
      src={assetUrl}
      style={{ objectFit: fit }}
    />
  );
}
function MediaVisual({
  active,
  section,
  mediaById,
  receiverId,
}: {
  active: boolean;
  section: ExperienceSection;
  mediaById: Map<string, ReceiverMediaDescriptor>;
  receiverId: string;
}) {
  if (section.type === "photo-slide") {
    const items = section.mediaIds
      .map((id) => mediaById.get(id))
      .filter((item): item is ReceiverMediaDescriptor => Boolean(item));
    return <PhotoSlide active={active} items={items} receiverId={receiverId} />;
  }

  const item = mediaById.get(section.mediaIds[0]);
  if (!item) return <div className="receiver-media-missing">Media tidak tersedia</div>;
  const treatment = section.mediaTreatment.find((value) => value.mediaId === item.id);

  return (
    <div className={`receiver-video-frame receiver-video-frame--${treatment?.fit ?? "cover"}`}>
      <ReceiverVideo
        active={active}
        assetUrl={receiverAssetUrl(receiverId, item.assetId)}
        fit={treatment?.fit ?? "cover"}
        loop={Boolean(treatment?.loop)}
        trimInSec={treatment?.trimInSec ?? null}
        trimOutSec={treatment?.trimOutSec ?? null}
        volume={treatment?.volume ?? 1}
      />
      <span className="receiver-media-credit">{item.contributorName ? `dari ${item.contributorName}` : "Kenangan pilihan"}</span>
    </div>
  );
}

function BackgroundTrack({ manifest }: { manifest: ReceiverManifest }) {
  const items = manifest.media.slice(0, 12);
  const doubled = [...items, ...items];
  return (
    <div className="receiver-memory-track" aria-hidden="true">
      <div className="receiver-memory-track__rail">
        {doubled.map((item, index) => (
          <div className="receiver-memory-thumb" key={`${item.id}-${index}`}>
            {item.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" loading="lazy" src={receiverAssetUrl(manifest.receiverId, item.assetId)} />
            ) : <VideoIcon size={22} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReceiverExperience({ manifest }: { manifest: ReceiverManifest }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState("hero");
  const [musicBlocked, setMusicBlocked] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const mediaById = useMemo(() => new Map(manifest.media.map((item) => [item.id, item])), [manifest.media]);
  const wishesById = useMemo(() => new Map(manifest.wishes.map((item) => [item.id, item])), [manifest.wishes]);
  const themeStyle = {
    "--receiver-bg": manifest.theme.palette.background,
    "--receiver-surface": manifest.theme.palette.surface,
    "--receiver-primary": manifest.theme.palette.primary,
    "--receiver-accent": manifest.theme.palette.accent,
    "--receiver-text": manifest.theme.palette.text,
    "--receiver-muted": manifest.theme.palette.muted,
    "--receiver-display-font": manifest.theme.typography.displayFamily,
    "--receiver-body-font": manifest.theme.typography.bodyFamily,
    "--receiver-background-image": `url("${receiverAssetUrl(manifest.receiverId, manifest.theme.backgroundAssetId)}")`,
  } as CSSProperties;

  const activeSection = manifest.experience.sections.find((section) => section.id === activeId) ?? null;

  async function startMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setMusicPlaying(true);
      setMusicBlocked(false);
    } catch {
      setMusicBlocked(true);
    }
  }

  function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void startMusic();
    else {
      audio.pause();
      setMusicPlaying(false);
    }
  }

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-receiver-slide]"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.intersectionRatio && visible.intersectionRatio >= 0.52) {
        const nextId = (visible.target as HTMLElement).dataset.sectionId;
        if (nextId) setActiveId(nextId);
      }
    }, { root, threshold: [0.25, 0.52, 0.65, 0.8, 1] });
    for (const slide of slides) observer.observe(slide);
    return () => observer.disconnect();
  }, []);



  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const mix = manifest.experience.backgroundMusicMix;
    const target = activeSection?.audioMix.mode === "auto-duck"
      ? Math.min(mix.duckedGain, mix.normalGain)
      : activeSection?.audioMix.mode === "music-muted"
        ? 0
        : mix.normalGain;
    const duration = target < audio.volume ? mix.duckAttackMs : mix.duckReleaseMs;
    const from = audio.volume;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = duration <= 0 ? 1 : Math.min(1, (now - started) / duration);
      audio.volume = from + (target - from) * progress;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeSection, manifest.experience.backgroundMusicMix]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = manifest.experience.backgroundMusicMix.normalGain;
    void audio.play().then(() => {
      setMusicPlaying(true);
      setMusicBlocked(false);
    }).catch(() => setMusicBlocked(true));
  }, [manifest.experience.backgroundMusicMix.normalGain]);

  useEffect(() => {
    if (!musicBlocked) return;
    const unlock = () => {
      const audio = audioRef.current;
      if (!audio) return;
      void audio.play().then(() => {
        setMusicPlaying(true);
        setMusicBlocked(false);
      }).catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [musicBlocked]);

  return (
    <main className="receiver-experience" style={themeStyle}>
      <audio
        loop
        onPause={() => setMusicPlaying(false)}
        onPlay={() => setMusicPlaying(true)}
        preload="auto"
        ref={audioRef}
        src={receiverAssetUrl(manifest.receiverId, manifest.music.trackAssetId)}
      />

      <div className="receiver-theme-background" aria-hidden="true" />
      <BackgroundTrack manifest={manifest} />
      <div className="receiver-theme-decorations" aria-hidden="true">
        {manifest.theme.decorations.map((decoration) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            key={decoration.id}
            src={receiverAssetUrl(manifest.receiverId, decoration.assetId)}
            style={{
              left: `${decoration.anchorX}%`,
              top: `${decoration.anchorY}%`,
              opacity: decoration.opacity,
              transform: `translate(-50%, -50%) scale(${decoration.scale})`,
            }}
          />
        ))}
      </div>

      <button
        aria-label={musicPlaying ? "Jeda background music" : "Putar background music"}
        className={`receiver-music-toggle ${musicBlocked ? "needs-action" : ""}`}
        onClick={toggleMusic}
        type="button"
      >
        <span>{musicPlaying ? "♫" : "♪"}</span>
        <div><strong>{manifest.music.name}</strong><small>{musicBlocked ? "Klik untuk mulai musik" : musicPlaying ? "Background music aktif" : "Musik dijeda"}</small></div>
      </button>

      <div className="receiver-scroller" ref={scrollerRef}>
        {manifest.experience.sections.map((section, index) => {
          const active = activeId === section.id;
          const wishes = sectionWishes(section, wishesById);
          return (
            <section
              className={`receiver-slide receiver-slide--${section.type} ${active ? "is-active" : ""}`}
              data-aura={section.auraIds.join(" ")}
              data-receiver-slide
              data-section-id={section.id}
              data-transition={section.transitionInId}
              key={section.id}
            >
              <div className="receiver-section-aura" aria-hidden="true" />
              <div className="receiver-focus-card">
                {section.type === "hero" ? (
                  <div className="receiver-hero-card">
                    <div className="receiver-gift-mark" aria-hidden="true">✦</div>
                    <p>{greetingFor(manifest.room.occasionId, manifest.room.recipientName)}</p>
                    <span>{section.microCopy ?? "Sebuah ruang kecil untuk kenangan yang dibuat bersama."}</span>
                  </div>
                ) : (
                  <>
                    <MediaVisual active={active} mediaById={mediaById} receiverId={manifest.receiverId} section={section} />
                    <div className="receiver-section-copy">
                      <small>{section.role ?? `Bagian ${index}`}</small>
                      {section.microCopy ? <p>{section.microCopy}</p> : null}
                    </div>
                  </>
                )}
              </div>
              {wishes.length > 0 ? <WishCloud active={active} wishes={wishes} /> : null}
            </section>
          );
        })}

        {manifest.wishes.length > 0 ? (
          <section
            className={`receiver-slide receiver-slide--wishes ${activeId === "wishes" ? "is-active" : ""}`}
            data-receiver-slide
            data-section-id="wishes"
          >
            <div className="receiver-focus-card receiver-wishes-card">
              <small>Ucapan dari mereka</small>
              <strong>Untuk {manifest.room.recipientName}</strong>
            </div>
            <WishCloud active={activeId === "wishes"} wishes={manifest.wishes} />
          </section>
        ) : null}
      </div>

      <div className="receiver-scroll-cue" aria-hidden="true"><ChevronDownIcon size={19} /></div>
      <div className="receiver-revision">Kenangin.id · r{manifest.revision}</div>
    </main>
  );
}
