import { defaultBackgroundMusicMixPolicy, resolveTheme } from "@/lib/creative";
import type { Media } from "@/lib/data/contracts";
import { defaultSceneAtmosphere, experienceDnaSchema, type ExperienceDNA, type RoomStudioConfig, type SceneAtmosphere, type StudioSectionPlan } from "./contracts";

export const sectionTypeLabels: Record<StudioSectionPlan["type"], string> = {
  video: "Main Video", photo: "Main Photo", "video-slide": "Slider Video", "photo-slide": "Slider Foto", text: "Teks",
};
export function sectionCapacity(type: StudioSectionPlan["type"]) { return type === "text" ? 0 : type.endsWith("-slide") ? 5 : 1; }
export function sectionMediaType(type: StudioSectionPlan["type"]) { return type.startsWith("video") ? "video" : type === "text" ? null : "photo"; }
export function sectionLabel(section: StudioSectionPlan, index: number) { return section.title?.trim() || `${sectionTypeLabels[section.type]} ${index + 1}`; }
export function emptySection(type: StudioSectionPlan["type"], id: string, order: number): StudioSectionPlan {
  return { id, type, order, mediaIds: [], title: "", caption: "", emphasis: false, music: null, atmosphere: null };
}

// Validate identity and media membership even for incomplete drafts. A missing
// slot may be saved, but a foreign/wrong-kind media ID must never enter a draft.
export function sectionProblems(studio: Pick<RoomStudioConfig, "sectionPlan" | "selectedMedia">, media?: Pick<Media, "id" | "type">[], complete = true): string[] {
  const errors: string[] = [];
  const selected = new Set(studio.selectedMedia.map(item => item.mediaId));
  const kinds = media ? new Map(media.map(item => [item.id, item.type])) : null;
  const ids = new Set<string>();
  if (complete && !studio.sectionPlan.length) errors.push("Tambahkan setidaknya satu section untuk ceritamu.");
  if (studio.sectionPlan.length > 80) errors.push("Cerita mendukung maksimal 80 section.");
  studio.sectionPlan.forEach((section, index) => {
    const label = sectionLabel(section, index);
    if (ids.has(section.id)) errors.push(`${label}: identitas section terduplikasi.`);
    ids.add(section.id);
    const capacity = sectionCapacity(section.type);
    if (section.mediaIds.length > capacity) errors.push(`${label}: maksimal ${capacity} media.`);
    if (complete && capacity && !section.mediaIds.length) errors.push(`${label}: isi slot medianya terlebih dahulu.`);
    if (complete && section.type === "text" && !section.caption?.trim()) errors.push(`${label}: tuliskan teksnya terlebih dahulu.`);
    if (new Set(section.mediaIds).size !== section.mediaIds.length) errors.push(`${label}: media yang sama terpasang dua kali di section ini.`);
    for (const id of section.mediaIds) {
      if (!selected.has(id)) errors.push(`${label}: media sudah tidak ada dalam pilihan Momen.`);
      if (kinds && kinds.get(id) !== sectionMediaType(section.type)) errors.push(`${label}: jenis media tidak sesuai slotnya.`);
    }
  });
  return errors;
}

// Legacy drafts carry their selected direction's order/copy into the new editor.
// Reading never rewrites the published Receiver, nor invents sections for a new draft.
export function upgradeStudioAuthoring(studio: RoomStudioConfig): RoomStudioConfig {
  if (studio.authoringVersion === 2) return studio;
  const direction = studio.directionCandidates.find(item => item.id === studio.selectedDirectionId);
  const source = direction ? direction.sections.map((section, order): StudioSectionPlan => ({
    id: section.id.startsWith("section_") ? section.id : `section_${section.id.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    type: section.type === "hero" ? "text" : section.type,
    mediaIds: section.mediaIds, order, title: section.title ?? (section.type === "hero" ? "Pembuka" : ""),
    caption: section.microCopy ?? (section.type === "hero" ? "Sebuah ruang kecil untuk kenangan yang dibuat bersama." : ""),
    emphasis: section.role === "emotional_peak", music: section.music ?? null, atmosphere: section.atmosphere ?? null,
  })) : studio.sectionPlan;
  const sections: StudioSectionPlan[] = [];
  for (const section of source) {
    const chunks = section.type.endsWith("-slide") && section.mediaIds.length > 5 ? Array.from({ length: Math.ceil(section.mediaIds.length / 5) }, (_, i) => section.mediaIds.slice(i * 5, i * 5 + 5)) : [section.mediaIds];
    chunks.forEach((mediaIds, i) => sections.push({ ...section, id: i ? `${section.id}_part${i + 1}` : section.id, mediaIds, caption: section.caption ?? "", title: section.title ?? "", emphasis: section.emphasis ?? false, music: section.music ?? null, atmosphere: section.atmosphere ?? null, order: sections.length }));
  }
  return { ...studio, authoringVersion: 2, atmosphere: direction?.atmosphere ?? defaultSceneAtmosphere, sectionPlan: sections, directionCandidates: [], selectedDirectionId: null };
}

export function effectiveAtmosphere(studio: Pick<RoomStudioConfig, "atmosphere">, section: StudioSectionPlan): SceneAtmosphere {
  const base = section.atmosphere ?? studio.atmosphere ?? defaultSceneAtmosphere;
  return section.emphasis && !section.atmosphere && base.intensity === "calm" ? { ...base, intensity: "balanced" } : base;
}

// Pure compilation is shared by preview and publication. No model is allowed to
// rewrite explicit captions, insert a hero, drop media or change the owner's order.
export function compileAuthoredExperience(studio: RoomStudioConfig, id: string, generatedAt: string): ExperienceDNA {
  const problems = sectionProblems(studio);
  if (problems.length) throw new Error(problems[0]);
  const theme = resolveTheme(studio.themeId);
  if (!theme) throw new Error("Tema cerita tidak tersedia.");
  return experienceDnaSchema.parse({
    schemaVersion: 1, authoringVersion: 2, rendererVersion: "rintik-resonansi-v2", id, directorVersion: "director-v1", generationMode: "fallback", generatedAt,
    name: "Cerita versimu", summary: "Urutan, keterangan, dan suasana yang kamu susun sendiri.", direction: "Susunan section pemilik",
    themeId: studio.themeId, backgroundMusic: studio.backgroundMusic, backgroundMusicMix: defaultBackgroundMusicMixPolicy,
    atmosphere: studio.atmosphere ?? defaultSceneAtmosphere,
    storyArc: studio.sectionPlan.slice(0, 12).map((section, i) => sectionLabel(section, i).slice(0, 80)),
    energyCurve: [0.35, 0.5], emotionCurve: [0.4, 0.6],
    sections: [...studio.sectionPlan].sort((a, b) => a.order - b.order).map((section, index) => {
      const atmosphere = effectiveAtmosphere(studio, section);
      return {
        id: section.id, type: section.type, mediaIds: section.mediaIds, title: sectionLabel(section, index),
        role: section.emphasis ? "emotional_peak" : null,
        auraIds: theme.compatibleAura.slice(0, 1), transitionInId: theme.compatibleTransitions[0], transitionOutId: null,
        dwellSeconds: 6, intensity: { calm: .22, balanced: .45, lively: .7 }[atmosphere.intensity],
        beatAlignment: atmosphere.response === "off" ? "none" : atmosphere.intensity === "lively" ? "strong" : "soft",
        audioMix: { mode: "auto-duck" }, mediaTreatment: section.mediaIds.map(mediaId => studio.selectedMedia.find(item => item.mediaId === mediaId)!),
        microCopy: section.caption?.trim() || null, wishIds: [], music: section.music ?? null, atmosphere,
      };
    }),
  });
}
