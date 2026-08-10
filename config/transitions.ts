import { transitionDefinitionSchema, type TransitionDefinition } from "@/lib/creative/contracts";
import { THEME_IDS } from "@/lib/creative/ids";

const allThemes = [...THEME_IDS];

const transitions: TransitionDefinition[] = [
  { schemaVersion: 1, id: "soft-reveal", name: "Soft Reveal", character: "soft", intensity: "low", durationRangeMs: [450, 1200], compatibleThemes: allThemes, compatibleMotionPersonalities: ["gentle", "floating", "cinematic", "playful", "energetic"], reducedMotionFallbackId: null, rendererKey: "soft-reveal" },
  { schemaVersion: 1, id: "memory-blur", name: "Memory Blur", character: "nostalgic", intensity: "medium", durationRangeMs: [500, 1300], compatibleThemes: ["theme_warm_memory", "theme_midnight_bloom", "theme_paper_daydream"], compatibleMotionPersonalities: ["gentle", "floating", "cinematic", "playful"], reducedMotionFallbackId: "soft-reveal", rendererKey: "memory-blur" },
  { schemaVersion: 1, id: "depth-push", name: "Depth Push", character: "cinematic", intensity: "medium", durationRangeMs: [400, 1000], compatibleThemes: allThemes, compatibleMotionPersonalities: ["gentle", "floating", "cinematic", "playful", "energetic"], reducedMotionFallbackId: "soft-reveal", rendererKey: "depth-push" },
  { schemaVersion: 1, id: "beat-cut", name: "Beat Cut", character: "rhythmic", intensity: "high", durationRangeMs: [120, 420], compatibleThemes: ["theme_golden_celebration", "theme_starlit_graduation"], compatibleMotionPersonalities: ["cinematic", "energetic"], reducedMotionFallbackId: "soft-reveal", rendererKey: "beat-cut" },
];

export const curatedTransitions = transitionDefinitionSchema.array().parse(transitions);
