import { z } from "zod";
import {
  creativeAssetReferenceSchema,
  motionPersonalitySchema,
  themePersonalitySchema,
} from "@/lib/creative/contracts";
import { auraIdSchema, themeIdSchema, transitionIdSchema } from "@/lib/creative/ids";

export const themePaletteSchema = z.object({
  background: z.string().min(1),
  surface: z.string().min(1),
  primary: z.string().min(1),
  accent: z.string().min(1),
  text: z.string().min(1),
  muted: z.string().min(1),
});

export const themeAnchorSchema = z.object({
  id: z.string().min(1),
  anchorX: z.number().min(0).max(100),
  anchorY: z.number().min(0).max(100),
  placement: z.enum(["foreground", "midground", "background"]),
  purpose: z.enum(["ornament", "media-safe-zone", "copy-safe-zone"]),
});

export const themeOrnamentSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  anchorId: z.string().min(1),
  scale: z.number().positive().max(4).default(1),
  opacity: z.number().min(0).max(1).default(1),
});

export const themeTypographySchema = z.object({
  displayFamily: z.string().min(1),
  bodyFamily: z.string().min(1),
  displayWeight: z.number().int().min(100).max(900),
  bodyWeight: z.number().int().min(100).max(900),
  letterSpacingEm: z.number().min(-0.2).max(0.5),
});

export const themeSchema = z.object({
  schemaVersion: z.literal(1),
  id: themeIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  assets: z.object({
    background: creativeAssetReferenceSchema,
    decorations: z.array(creativeAssetReferenceSchema),
  }),
  palette: themePaletteSchema,
  ornaments: z.array(themeOrnamentSchema),
  anchors: z.array(themeAnchorSchema),
  typography: themeTypographySchema,
  motionPersonality: motionPersonalitySchema,
  themePersonality: z.array(themePersonalitySchema).min(1),
  compatibleAura: z.array(auraIdSchema).min(1),
  compatibleTransitions: z.array(transitionIdSchema).min(1),
  occasionIds: z.array(z.string().min(1)).default([]),
});

export type ThemePalette = z.infer<typeof themePaletteSchema>;
export type ThemeAnchor = z.infer<typeof themeAnchorSchema>;
export type ThemeOrnament = z.infer<typeof themeOrnamentSchema>;
export type ThemeTypography = z.infer<typeof themeTypographySchema>;
export type Theme = z.infer<typeof themeSchema>;
