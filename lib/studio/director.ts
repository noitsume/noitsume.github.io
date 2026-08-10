import "server-only";

import { Type } from "@google/genai";
import {
  creativeCatalog,
  defaultBackgroundMusicMixPolicy,
  resolveSong,
  resolveTheme,
  type AuraId,
  type BackgroundMusicSelection,
  type RoomMusic,
  type TransitionId,
} from "@/lib/creative";
import type { Media, Submission } from "@/lib/data/contracts";
import { getGeminiClient, getGeminiModelConfig } from "@/lib/ai";
import { createId } from "@/lib/utils/id";
import { withTimeout } from "@/lib/utils/timeout";
import {
  EXPERIENCE_DIRECTOR_VERSION,
  experienceDnaSchema,
  type ExperienceDNA,
  type ExperienceSection,
  type RoomStudioConfig,
  type StudioSectionPlan,
} from "./contracts";

const ROLE_VALUES = [
  "opening",
  "memory",
  "bridge",
  "comic_relief",
  "buildup",
  "emotional_peak",
  "celebration",
  "resolution",
  "closing",
  "ambient_only",
] as const;

const rawDirectorResponseSchema = {
  type: Type.OBJECT,
  properties: {
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          summary: { type: Type.STRING },
          direction: { type: Type.STRING },
          storyArc: { type: Type.ARRAY, items: { type: Type.STRING } },
          energyCurve: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          emotionCurve: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          sectionTuning: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sectionId: { type: Type.STRING },
                role: { type: Type.STRING, enum: [...ROLE_VALUES], nullable: true },
                auraIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                transitionInId: { type: Type.STRING },
                transitionOutId: { type: Type.STRING, nullable: true },
                dwellSeconds: { type: Type.NUMBER },
                intensity: { type: Type.NUMBER },
                beatAlignment: { type: Type.STRING, enum: ["none", "soft", "strong"] },
                microCopy: { type: Type.STRING, nullable: true },
                wishIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                "sectionId",
                "role",
                "auraIds",
                "transitionInId",
                "transitionOutId",
                "dwellSeconds",
                "intensity",
                "beatAlignment",
                "microCopy",
                "wishIds",
              ],
            },
          },
        },
        required: ["name", "summary", "direction", "storyArc", "energyCurve", "emotionCurve", "sectionTuning"],
      },
    },
  },
  required: ["candidates"],
} as const;

type RawSectionTuning = {
  sectionId: string;
  role: (typeof ROLE_VALUES)[number] | null;
  auraIds: string[];
  transitionInId: string;
  transitionOutId: string | null;
  dwellSeconds: number;
  intensity: number;
  beatAlignment: "none" | "soft" | "strong";
  microCopy: string | null;
  wishIds: string[];
};

type RawCandidate = {
  name: string;
  summary: string;
  direction: string;
  storyArc: string[];
  energyCurve: number[];
  emotionCurve: number[];
  sectionTuning: RawSectionTuning[];
};

type DirectorInput = {
  roomId: string;
  recipientName: string;
  occasionId: string;
  studio: RoomStudioConfig;
  media: Media[];
  submissions: Submission[];
  roomMusic: RoomMusic | null;
  variantCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function compatibleAuraIds(themeId: string) {
  const theme = resolveTheme(themeId);
  if (!theme) return ["neutral"] as AuraId[];
  return theme.compatibleAura;
}

function compatibleTransitionIds(themeId: string) {
  const theme = resolveTheme(themeId);
  if (!theme) return ["soft-reveal"] as TransitionId[];
  return theme.compatibleTransitions;
}

function defaultRole(section: StudioSectionPlan, mediaById: Map<string, Media>) {
  const first = mediaById.get(section.mediaIds[0]);
  return first?.mediaIntelligence?.suggestedRoles[0] ?? (section.type === "photo-slide" ? "memory" : "bridge");
}

function sectionDefaultDwell(section: StudioSectionPlan, mediaById: Map<string, Media>) {
  if (section.type === "photo-slide") return clamp(4 + section.mediaIds.length * 1.6, 5, 16);
  const media = mediaById.get(section.mediaIds[0]);
  const duration = media?.durationSec ?? media?.technicalSignals?.durationSec ?? 8;
  return clamp(duration, 4, 16);
}

function normalizeCurve(values: number[], fallback: number[]) {
  const normalized = values.filter(Number.isFinite).slice(0, 24).map((value) => clamp(value, 0, 1));
  return normalized.length >= 2 ? normalized : fallback;
}

function safeCopy(value: string | null, max = 180) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function sectionMediaTreatment(section: StudioSectionPlan, studio: RoomStudioConfig) {
  const settings = new Map(studio.selectedMedia.map((item) => [item.mediaId, item]));
  return section.mediaIds.map((mediaId) => {
    const item = settings.get(mediaId);
    return {
      mediaId,
      volume: item?.volume ?? 1,
      trimInSec: item?.trimInSec ?? null,
      trimOutSec: item?.trimOutSec ?? null,
      loop: item?.loop ?? false,
      fit: item?.fit ?? "cover" as const,
    };
  });
}

function normalizeAuraSelection(raw: string[], allowed: AuraId[]) {
  const filtered = raw.filter((id): id is AuraId => allowed.includes(id as AuraId));
  const unique = Array.from(new Set(filtered)).slice(0, 2);
  if (unique.length > 0) return unique;
  return allowed.includes("neutral") ? ["neutral" as const] : allowed.slice(0, 1);
}

function normalizeTransition(raw: string | null, allowed: TransitionId[], fallback: TransitionId) {
  return raw && allowed.includes(raw as TransitionId) ? raw as TransitionId : fallback;
}

function buildSections(
  studio: RoomStudioConfig,
  media: Media[],
  wishes: Submission[],
  tuning: RawSectionTuning[],
): ExperienceSection[] {
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const tuningById = new Map(tuning.map((item) => [item.sectionId, item]));
  const allowedAuras = compatibleAuraIds(studio.themeId);
  const allowedTransitions = compatibleTransitionIds(studio.themeId);
  const transitionFallback = allowedTransitions.includes("soft-reveal") ? "soft-reveal" : allowedTransitions[0];
  const wishIds = new Set(wishes.map((item) => item.id));
  const heroRaw = tuningById.get("hero");

  const sections: ExperienceSection[] = [
    {
      id: "hero",
      type: "hero",
      mediaIds: [],
      role: null,
      auraIds: normalizeAuraSelection(heroRaw?.auraIds ?? [allowedAuras[0]], allowedAuras),
      transitionInId: normalizeTransition(heroRaw?.transitionInId ?? null, allowedTransitions, transitionFallback),
      transitionOutId: normalizeTransition(heroRaw?.transitionOutId ?? null, allowedTransitions, transitionFallback),
      dwellSeconds: clamp(heroRaw?.dwellSeconds ?? 5, 3, 12),
      intensity: clamp(heroRaw?.intensity ?? 0.22, 0, 1),
      beatAlignment: heroRaw?.beatAlignment ?? "soft",
      audioMix: { mode: "music-full" },
      mediaTreatment: [],
      microCopy: safeCopy(heroRaw?.microCopy ?? `Selamat untuk ${"momen spesial ini"}.`),
      wishIds: (heroRaw?.wishIds ?? []).filter((id) => wishIds.has(id)).slice(0, 4),
    },
  ];

  for (const plan of [...studio.sectionPlan].sort((a, b) => a.order - b.order)) {
    const raw = tuningById.get(plan.id);
    const firstMedia = mediaById.get(plan.mediaIds[0]);
    const hasForegroundAudio = plan.type === "video"
      && (studio.selectedMedia.find((item) => item.mediaId === firstMedia?.id)?.volume ?? 1) > 0
      && firstMedia?.technicalSignals?.audioPresence !== "absent";

    sections.push({
      id: plan.id,
      type: plan.type,
      mediaIds: plan.mediaIds,
      role: raw?.role ?? defaultRole(plan, mediaById),
      auraIds: normalizeAuraSelection(raw?.auraIds ?? [allowedAuras[0]], allowedAuras),
      transitionInId: normalizeTransition(raw?.transitionInId ?? null, allowedTransitions, transitionFallback),
      transitionOutId: raw?.transitionOutId === null
        ? null
        : normalizeTransition(raw?.transitionOutId ?? null, allowedTransitions, transitionFallback),
      dwellSeconds: clamp(raw?.dwellSeconds ?? sectionDefaultDwell(plan, mediaById), 2, 20),
      intensity: clamp(raw?.intensity ?? firstMedia?.mediaIntelligence?.emotionalFingerprint.energy ?? 0.45, 0, 1),
      beatAlignment: raw?.beatAlignment ?? (plan.type === "video" ? "soft" : "none"),
      audioMix: { mode: hasForegroundAudio ? "auto-duck" : "music-full" },
      mediaTreatment: sectionMediaTreatment(plan, studio),
      microCopy: safeCopy(raw?.microCopy ?? null),
      wishIds: (raw?.wishIds ?? []).filter((id) => wishIds.has(id)).slice(0, 8),
    });
  }

  return sections;
}

function musicContext(selection: BackgroundMusicSelection, roomMusic: RoomMusic | null) {
  if (selection.source === "catalog") {
    const song = resolveSong(selection.songId);
    return song ? {
      source: "catalog",
      id: song.id,
      name: song.name,
      bpm: song.bpm,
      durationSec: song.durationSec,
      mood: song.mood,
      sections: song.sections,
    } : null;
  }
  if (!roomMusic) return null;
  return {
    source: "room-upload",
    id: roomMusic.id,
    name: roomMusic.name,
    bpm: roomMusic.analysis.bpm,
    durationSec: roomMusic.analysis.durationSec,
    mood: roomMusic.analysis.mood,
    sections: roomMusic.analysis.sections,
  };
}

function promptFor(input: DirectorInput) {
  const theme = resolveTheme(input.studio.themeId);
  const mediaById = new Map(input.media.map((item) => [item.id, item]));
  const selected = input.studio.selectedMedia.map((setting) => {
    const media = mediaById.get(setting.mediaId);
    return {
      id: setting.mediaId,
      type: media?.type,
      volume: setting.volume,
      trimInSec: setting.trimInSec,
      trimOutSec: setting.trimOutSec,
      scene: media?.mediaIntelligence?.scene ?? null,
      socialContext: media?.mediaIntelligence?.socialContext ?? null,
      emotion: media?.mediaIntelligence?.emotionalFingerprint ?? null,
      suggestedRoles: media?.mediaIntelligence?.suggestedRoles ?? [],
      audio: media?.mediaIntelligence?.audio ?? null,
      technical: media?.technicalSignals ?? null,
    };
  });
  const wishes = input.submissions
    .filter((item) => item.status === "approved" && item.message?.trim())
    .map((item) => ({
      id: item.id,
      from: item.contributorName ?? "Anonim",
      text: item.message,
      intelligence: input.studio.wishIntelligence[item.id] ?? null,
    }));
  const allowedAuras = creativeCatalog.auras
    .filter((item) => theme?.compatibleAura.includes(item.id))
    .map((item) => ({ id: item.id, description: item.description, intensityRange: item.intensityRange }));
  const allowedTransitions = creativeCatalog.transitions
    .filter((item) => theme?.compatibleTransitions.includes(item.id))
    .map((item) => ({ id: item.id, character: item.character, intensity: item.intensity }));

  return [
    "You are Kenangin Experience Director. Produce creative direction only; never HTML, CSS, JavaScript, URLs, or executable instructions.",
    "All selected media are a hard inclusion constraint. Do not drop or duplicate media. The deterministic section plan is fixed: every video is one section and all selected photos are one photo-slide section.",
    "Story Anchors are optional human guidance, not hard placement constraints. If anchors are empty, infer placement from Media Intelligence.",
    "Background music is a continuous global timeline. Never pause/seek it between sections. A video with audible foreground is auto-ducked by the engine; do not change that policy.",
    "Use only the provided Aura IDs and Transition IDs. Keep emotional importance separate from visual energy.",
    "Micro-copy may be short chapter/bridge text, but never fabricate a wish or pretend to quote a contributor.",
    `Return ${input.variantCount} meaningfully different candidate direction(s).`,
    `Recipient: ${input.recipientName}; occasion: ${input.occasionId}.`,
    `Theme: ${JSON.stringify(theme ? { id: theme.id, personality: theme.themePersonality, motion: theme.motionPersonality } : null)}.`,
    `Music: ${JSON.stringify(input.studio.backgroundMusic ? musicContext(input.studio.backgroundMusic, input.roomMusic) : null)}.`,
    `Section plan: ${JSON.stringify([{ id: "hero", type: "hero", mediaIds: [] }, ...input.studio.sectionPlan])}.`,
    `Selected media: ${JSON.stringify(selected)}.`,
    `Story Anchors: ${JSON.stringify(input.studio.storyAnchors)}.`,
    `Approved wishes + reusable Wish Intelligence: ${JSON.stringify(wishes)}.`,
    `Allowed Auras: ${JSON.stringify(allowedAuras)}.`,
    `Allowed Transitions: ${JSON.stringify(allowedTransitions)}.`,
  ].join("\n");
}

function candidateFromRaw(input: DirectorInput, raw: RawCandidate, generationMode: "gemini" | "fallback") {
  const wishes = input.submissions.filter((item) => item.status === "approved" && item.message?.trim());
  return experienceDnaSchema.parse({
    schemaVersion: 1,
    id: createId("direction"),
    directorVersion: EXPERIENCE_DIRECTOR_VERSION,
    generationMode,
    generatedAt: new Date().toISOString(),
    name: (raw.name || "Kenangin Direction").slice(0, 80),
    summary: (raw.summary || "Direction tersusun dari media dan setting Room.").slice(0, 420),
    direction: (raw.direction || "balanced-memory-flow").slice(0, 120),
    themeId: input.studio.themeId,
    backgroundMusic: input.studio.backgroundMusic!,
    backgroundMusicMix: defaultBackgroundMusicMixPolicy,
    storyArc: (raw.storyArc.length > 0 ? raw.storyArc : ["opening", "memory", "climax", "ending"]).slice(0, 12),
    energyCurve: normalizeCurve(raw.energyCurve, [0.2, 0.45, 0.72, 0.4, 0.24]),
    emotionCurve: normalizeCurve(raw.emotionCurve, [0.32, 0.5, 0.78, 0.92, 0.64]),
    sections: buildSections(input.studio, input.media, wishes, raw.sectionTuning),
  });
}

function fallbackCandidate(input: DirectorInput): ExperienceDNA {
  const mediaById = new Map(input.media.map((item) => [item.id, item]));
  const anchorRole = new Map<string, (typeof ROLE_VALUES)[number]>();
  input.studio.storyAnchors.opening.forEach((id) => anchorRole.set(id, "opening"));
  input.studio.storyAnchors.climax.forEach((id) => anchorRole.set(id, "emotional_peak"));
  input.studio.storyAnchors.ending.forEach((id) => anchorRole.set(id, "closing"));
  const allowedAuras = compatibleAuraIds(input.studio.themeId);
  const allowedTransitions = compatibleTransitionIds(input.studio.themeId);
  const transition = allowedTransitions.includes("soft-reveal") ? "soft-reveal" : allowedTransitions[0];

  const tuning: RawSectionTuning[] = [
    {
      sectionId: "hero",
      role: null,
      auraIds: allowedAuras.includes("gentle-bokeh") ? ["gentle-bokeh"] : [allowedAuras[0]],
      transitionInId: transition,
      transitionOutId: transition,
      dwellSeconds: 5,
      intensity: 0.2,
      beatAlignment: "soft",
      microCopy: `Sebuah kenangan untuk ${input.recipientName}`,
      wishIds: [],
    },
  ];

  for (const plan of input.studio.sectionPlan) {
    const first = mediaById.get(plan.mediaIds[0]);
    const explicitRole = plan.mediaIds.map((id) => anchorRole.get(id)).find(Boolean);
    const role = explicitRole ?? first?.mediaIntelligence?.suggestedRoles[0] ?? (plan.type === "photo-slide" ? "memory" : "bridge");
    const emotion = first?.mediaIntelligence?.emotionalFingerprint;
    const intensity = emotion?.energy ?? 0.42;
    const aura = role === "emotional_peak" && allowedAuras.includes("soft-rays")
      ? "soft-rays"
      : role === "celebration" && allowedAuras.includes("celebration-particles")
        ? "celebration-particles"
        : allowedAuras.includes("gentle-breath")
          ? "gentle-breath"
          : allowedAuras[0];
    tuning.push({
      sectionId: plan.id,
      role,
      auraIds: [aura],
      transitionInId: transition,
      transitionOutId: transition,
      dwellSeconds: sectionDefaultDwell(plan, mediaById),
      intensity,
      beatAlignment: plan.type === "video" ? "soft" : "none",
      microCopy: null,
      wishIds: [],
    });
  }

  return candidateFromRaw(input, {
    name: "Balanced Memory",
    summary: "Fallback deterministic yang memasukkan seluruh media pilihan dan memakai Story Anchors bila tersedia.",
    direction: "deterministic-balanced-memory",
    storyArc: ["warm-opening", "memory-flow", "emotional-rise", "soft-ending"],
    energyCurve: [0.2, 0.38, 0.62, 0.48, 0.26],
    emotionCurve: [0.34, 0.5, 0.72, 0.9, 0.68],
    sectionTuning: tuning,
  }, "fallback");
}

export async function generateExperienceDirections(input: DirectorInput): Promise<ExperienceDNA[]> {
  if (!input.studio.backgroundMusic) return [fallbackCandidate(input)];

  try {
    const ai = getGeminiClient();
    const { textModel, timeoutMs } = getGeminiModelConfig();
    // Experience Director is intentionally allowed to wait longer than Quick Look.
    // The user already committed their Studio settings; after this bound we preserve
    // progress with a deterministic direction that includes every selected media.
    const directorTimeoutMs = Math.max(timeoutMs, 30_000);
    const response = await withTimeout(
      ai.models.generateContent({
        model: textModel,
        contents: promptFor(input),
        config: {
          responseMimeType: "application/json",
          responseSchema: rawDirectorResponseSchema,
          temperature: 0.62,
        },
      }),
      directorTimeoutMs,
      "Gemini Experience Director timeout",
    );

    const text = response.text?.trim();
    if (!text) return [fallbackCandidate(input)];
    const parsed = JSON.parse(text) as { candidates?: RawCandidate[] };
    const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates.slice(0, input.variantCount) : [];
    const candidates = rawCandidates.map((candidate) => candidateFromRaw(input, candidate, "gemini"));
    return candidates.length > 0 ? candidates : [fallbackCandidate(input)];
  } catch (error) {
    console.error("Gemini Experience Director fallback", error);
    return [fallbackCandidate(input)];
  }
}
