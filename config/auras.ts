import { auraDefinitionSchema, type AuraDefinition } from "@/lib/creative/contracts";
import { THEME_IDS } from "@/lib/creative/ids";

const allThemes = [...THEME_IDS];

const auras: AuraDefinition[] = [
  { schemaVersion: 1, id: "neutral", name: "Neutral", family: "neutral", description: "No decorative Aura; preserves the base theme treatment.", intensityRange: [0, 0], motionCharacter: "none", compatibleThemes: allThemes, reducedMotionBehavior: "disable", rendererKey: "neutral" },
  { schemaVersion: 1, id: "memory-drift", name: "Memory Drift", family: "transform", description: "Slow floating movement for reflective memory moments.", intensityRange: [0.15, 0.55], motionCharacter: "subtle", compatibleThemes: ["theme_warm_memory", "theme_midnight_bloom", "theme_paper_daydream"], reducedMotionBehavior: "reduce", rendererKey: "floating" },
  { schemaVersion: 1, id: "gentle-breath", name: "Gentle Breath", family: "transform", description: "Soft scale breathing that adds life without stealing focus.", intensityRange: [0.1, 0.45], motionCharacter: "subtle", compatibleThemes: allThemes, reducedMotionBehavior: "reduce", rendererKey: "breath" },
  { schemaVersion: 1, id: "cinematic-tilt", name: "Cinematic Tilt", family: "transform", description: "Measured depth tilt for cinematic emphasis.", intensityRange: [0.2, 0.6], motionCharacter: "expressive", compatibleThemes: ["theme_midnight_bloom", "theme_starlit_graduation"], reducedMotionBehavior: "disable", rendererKey: "tilt" },
  { schemaVersion: 1, id: "zoom-pulse", name: "Zoom Pulse", family: "transform", description: "Beat-friendly scale pulse for energetic peaks.", intensityRange: [0.35, 0.9], motionCharacter: "energetic", compatibleThemes: ["theme_golden_celebration"], reducedMotionBehavior: "reduce", rendererKey: "zoom-pulse" },
  { schemaVersion: 1, id: "celebration-particles", name: "Celebration Particles", family: "overlay", description: "Curated particle overlay for joyful celebration moments.", intensityRange: [0.25, 0.85], motionCharacter: "energetic", compatibleThemes: ["theme_golden_celebration", "theme_paper_daydream"], reducedMotionBehavior: "static-overlay", rendererKey: "particles" },
  { schemaVersion: 1, id: "soft-rays", name: "Soft Rays", family: "overlay", description: "Slow volumetric rays for emotional or triumphant highlights.", intensityRange: [0.15, 0.65], motionCharacter: "subtle", compatibleThemes: ["theme_warm_memory", "theme_midnight_bloom", "theme_golden_celebration", "theme_starlit_graduation"], reducedMotionBehavior: "static-overlay", rendererKey: "soft-ray" },
  { schemaVersion: 1, id: "warm-flare", name: "Warm Flare", family: "overlay", description: "Controlled lens-flare accent for warm peak moments.", intensityRange: [0.15, 0.7], motionCharacter: "expressive", compatibleThemes: ["theme_warm_memory", "theme_golden_celebration", "theme_starlit_graduation"], reducedMotionBehavior: "fade-only", rendererKey: "flare" },
  { schemaVersion: 1, id: "gentle-bokeh", name: "Gentle Bokeh", family: "overlay", description: "Soft depth lights for intimate and dreamy sections.", intensityRange: [0.1, 0.55], motionCharacter: "subtle", compatibleThemes: ["theme_warm_memory", "theme_midnight_bloom", "theme_paper_daydream", "theme_starlit_graduation"], reducedMotionBehavior: "static-overlay", rendererKey: "bokeh" },
];

export const curatedAuras = auraDefinitionSchema.array().parse(auras);
