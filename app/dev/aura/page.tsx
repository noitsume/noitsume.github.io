import { notFound } from "next/navigation";
import { ReceiverExperience } from "@/components/receiver/receiver-experience";
import { resolveTheme } from "@/lib/creative/catalog";
import { compileAuthoredExperience } from "@/lib/studio/authoring";
import { roomStudioConfigSchema } from "@/lib/studio/contracts";
import { receiverManifestSchema } from "@/lib/data/contracts/receiver";

export default async function AuraLab({ searchParams }: { searchParams: Promise<{ legacy?: string; silent?: string; intensity?: string; world?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  const theme = resolveTheme("theme_warm_memory")!;
  const stamp = "2026-10-10T12:00:00.000Z";
  const ids = ["landscape", "portrait", "video"];
  const studio = roomStudioConfigSchema.parse({
    schemaVersion: 1, authoringVersion: 2, themeId: theme.id,
    atmosphere: { world: query.world === "resonance" ? "resonance" : "light", intensity: query.intensity === "lively" ? "lively" : "balanced", response: "beat", motion: "soft", backgroundAura: true },
    selectedMedia: ids.map((mediaId, order) => ({ mediaId, order, volume: .5, trimInSec: null, trimOutSec: null, loop: false, fit: "contain" })),
    sectionPlan: [
      { id: "section_landscape", type: "photo", mediaIds: ["landscape"], order: 0, title: "Waktu yang kita simpan", caption: "Ada hal-hal kecil yang tetap tinggal, bahkan setelah harinya berlalu." },
      { id: "section_portrait", type: "photo", mediaIds: ["portrait"], order: 1, title: "Lebih dekat", caption: "Satu momen. Banyak alasan untuk mengingatnya.", emphasis: true, music: { source: "room-upload", musicId: "room_music_fixture02" } },
      { id: "section_video", type: "video", mediaIds: ["video"], order: 2, title: "Suara di dalam kenangan", caption: "Fixture video dengan suara; kontrol dan prioritas audio tetap milik pemutar." },
      { id: "section_letter", type: "text", mediaIds: [], order: 3, title: "Untuk dibaca pelan-pelan", caption: ("Terima kasih sudah hadir. Semoga selalu ada ruang untuk hal-hal yang membuatmu merasa pulang.\n\n").repeat(9) },
    ],
    storyAnchors: { opening: [], climax: [], ending: [] }, storyAnchorsConfirmed: true,
    backgroundMusic: null, directionCandidates: [], selectedDirectionId: null, updatedAt: stamp,
  });
  const experience = compileAuthoredExperience(studio, "direction_aurafixture01", stamp);
  if (query.legacy) delete experience.rendererVersion;
  const track = (id: string) => ({ name: "Sinyal uji lokal (bukan analisis lagu)", trackAssetId: id, beatmapSource: "inline" as const, beatmapAssetId: null, bpm: 120, durationSec: 10, mood: [], beats: Array.from({ length: 20 }, (_, i) => i * .5), onsets: [], energyCurve: [.1,.8,.2,.7,.3,.9,.1] });
  const manifest = receiverManifestSchema.parse({
    schemaVersion: 1, receiverId: "aura-development-fixture", revision: 1, bakedAt: stamp,
    room: { id: "aura-lab", title: "Ruang yang Mengingat · fixture", recipientName: "Sahabat", occasionId: "birthday" },
    theme: { ...theme, backgroundAssetId: "background", decorations: [] },
    assets: [{ id: "background", kind: "theme-background", contentType: "image/svg+xml", delivery: "public", publicPath: "/creative/themes/theme_warm_memory/background.svg", mediaId: null }],
    media: ids.map((id, i) => ({ id, assetId: id, type: i === 2 ? "video" : "photo", contentType: i === 2 ? "video/mp4" : "image/svg+xml", width: i === 1 ? 700 : 1200, height: i === 1 ? 1000 : 800, durationSec: i === 2 ? 8 : null, audioPresence: i === 2 ? "present" : "absent", contributorName: null, originalFileName: "Ilustrasi uji " + id })),
    wishes: [{ id: "wish_fixture", text: "Ini ucapan fixture, bukan data pengguna. Terima kasih sudah menjadi bagian dari cerita ini.", contributorName: "Teman" }],
    experience, music: query.silent ? null : track("music-background"), sectionMusic: query.silent ? {} : { room_music_fixture02: track("music-section") },
  });
  const illustration = (portrait: boolean) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 700 : 1200}" height="${portrait ? 1000 : 800}" viewBox="${portrait ? "250 0 700 1000" : "0 0 1200 800"}"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#b5cac5"/><stop offset="1" stop-color="#e2c3a1"/></linearGradient></defs><rect width="1200" height="1000" fill="url(#s)"/><circle cx="820" cy="220" r="90" fill="#f8e4b5"/><path d="M0 500Q220 270 530 520T1200 430V1000H0" fill="#536f6a"/><path d="M0 650Q350 440 670 660T1200 540V1000H0" fill="#253e3e"/><text x="65" y="100" fill="#294740" font-family="Georgia" font-size="40">${portrait ? "Lebih dekat." : "Sore yang tinggal."}</text><text x="65" y="145" fill="#294740" font-family="sans-serif" font-size="15" letter-spacing="4">KENANGIN · ILUSTRASI UJI</text></svg>`);
  return <ReceiverExperience manifest={manifest} embedded={false} previewAssetUrls={{ landscape: illustration(false), portrait: illustration(true), video: "/dev/aura/assets/video", "music-background": "/dev/aura/assets/music-background", "music-section": "/dev/aura/assets/music-section" }} />;
}
