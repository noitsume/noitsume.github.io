import { curatedAuras } from "@/config/auras";
import { curatedSongs } from "@/config/songs";
import { curatedThemes } from "@/config/themes";
import { curatedTransitions } from "@/config/transitions";
import type { Theme } from "@/lib/data/contracts/theme";
import {
  creativeSelectionSchema,
  type AuraDefinition,
  type CreativeSelection,
  type SongDefinition,
  type TransitionDefinition,
} from "./contracts";
import {
  auraIdSchema,
  songIdSchema,
  themeIdSchema,
  transitionIdSchema,
  type AuraId,
  type SongId,
  type ThemeId,
  type TransitionId,
} from "./ids";

const themesById = new Map<ThemeId, Theme>(curatedThemes.map((item): [ThemeId, Theme] => [item.id, item]));
const aurasById = new Map<AuraId, AuraDefinition>(curatedAuras.map((item): [AuraId, AuraDefinition] => [item.id, item]));
const transitionsById = new Map<TransitionId, TransitionDefinition>(curatedTransitions.map((item): [TransitionId, TransitionDefinition] => [item.id, item]));
const songsById = new Map<SongId, SongDefinition>(curatedSongs.map((item): [SongId, SongDefinition] => [item.id, item]));

export class CreativeCatalogError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CreativeCatalogError";
  }
}

export function resolveTheme(id: string): Theme | null {
  const parsed = themeIdSchema.safeParse(id);
  return parsed.success ? themesById.get(parsed.data) ?? null : null;
}

export function resolveAura(id: string): AuraDefinition | null {
  const parsed = auraIdSchema.safeParse(id);
  return parsed.success ? aurasById.get(parsed.data) ?? null : null;
}

export function resolveTransition(id: string): TransitionDefinition | null {
  const parsed = transitionIdSchema.safeParse(id);
  return parsed.success ? transitionsById.get(parsed.data) ?? null : null;
}

export function resolveSong(id: string): SongDefinition | null {
  const parsed = songIdSchema.safeParse(id);
  return parsed.success ? songsById.get(parsed.data) ?? null : null;
}

export function requireTheme(id: string): Theme {
  const value = resolveTheme(id);
  if (!value) throw new CreativeCatalogError("UNKNOWN_THEME", `Unknown Theme ID: ${id}`);
  return value;
}

export function requireAura(id: string): AuraDefinition {
  const value = resolveAura(id);
  if (!value) throw new CreativeCatalogError("UNKNOWN_AURA", `Unknown Aura ID: ${id}`);
  return value;
}

export function requireTransition(id: string): TransitionDefinition {
  const value = resolveTransition(id);
  if (!value) throw new CreativeCatalogError("UNKNOWN_TRANSITION", `Unknown Transition ID: ${id}`);
  return value;
}

export function requireSong(id: string): SongDefinition {
  const value = resolveSong(id);
  if (!value) throw new CreativeCatalogError("UNKNOWN_SONG", `Unknown Song ID: ${id}`);
  return value;
}

export type CreativeCompatibilityResult = {
  ok: boolean;
  issues: string[];
};

export function validateCreativeSelection(input: unknown): CreativeCompatibilityResult {
  const parsedSelection = creativeSelectionSchema.safeParse(input);
  if (!parsedSelection.success) {
    return {
      ok: false,
      issues: parsedSelection.error.issues.map((issue) => `${issue.path.join(".") || "selection"}: ${issue.message}`),
    };
  }

  const selection = parsedSelection.data;
  const theme = requireTheme(selection.themeId);
  const issues: string[] = [];

  if (selection.backgroundMusic.source === "catalog") {
    const song = requireSong(selection.backgroundMusic.songId);
    if (!song.compatibleThemes.includes(theme.id)) {
      issues.push(`Song ${song.id} is not compatible with Theme ${theme.id}.`);
    }
  }

  // Room-uploaded music is validated against Room ownership/storage in Patch 7.
  // Theme compatibility must not reject an explicit owner music choice.

  for (const auraId of selection.auraIds) {
    const aura = requireAura(auraId);
    if (!theme.compatibleAura.includes(aura.id) || !aura.compatibleThemes.includes(theme.id)) {
      issues.push(`Aura ${aura.id} is not compatible with Theme ${theme.id}.`);
    }
  }

  for (const transitionId of selection.transitionIds) {
    const transition = requireTransition(transitionId);
    if (
      !theme.compatibleTransitions.includes(transition.id) ||
      !transition.compatibleThemes.includes(theme.id) ||
      !transition.compatibleMotionPersonalities.includes(theme.motionPersonality)
    ) {
      issues.push(`Transition ${transition.id} is not compatible with Theme ${theme.id}.`);
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertCreativeSelection(input: unknown): CreativeSelection {
  const parsed = creativeSelectionSchema.parse(input);
  const result = validateCreativeSelection(parsed);
  if (!result.ok) {
    throw new CreativeCatalogError("INCOMPATIBLE_CREATIVE_SELECTION", result.issues.join(" "));
  }
  return parsed;
}

export function validateCreativeCatalogIntegrity(): CreativeCompatibilityResult {
  const issues: string[] = [];

  for (const theme of curatedThemes) {
    const assetIds = new Set([
      theme.assets.background.id,
      ...theme.assets.decorations.map((asset) => asset.id),
    ]);
    const anchorIds = new Set(theme.anchors.map((anchor) => anchor.id));

    for (const ornament of theme.ornaments) {
      if (!assetIds.has(ornament.assetId)) {
        issues.push(`Theme ${theme.id} ornament ${ornament.id} references missing asset ${ornament.assetId}.`);
      }
      if (!anchorIds.has(ornament.anchorId)) {
        issues.push(`Theme ${theme.id} ornament ${ornament.id} references missing anchor ${ornament.anchorId}.`);
      }
    }

    for (const auraId of theme.compatibleAura) {
      const aura = requireAura(auraId);
      if (!aura.compatibleThemes.includes(theme.id)) {
        issues.push(`Theme ${theme.id} and Aura ${aura.id} compatibility is not reciprocal.`);
      }
    }

    for (const transitionId of theme.compatibleTransitions) {
      const transition = requireTransition(transitionId);
      if (!transition.compatibleThemes.includes(theme.id)) {
        issues.push(`Theme ${theme.id} and Transition ${transition.id} compatibility is not reciprocal.`);
      }
      if (!transition.compatibleMotionPersonalities.includes(theme.motionPersonality)) {
        issues.push(`Theme ${theme.id} motion personality cannot execute Transition ${transition.id}.`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export const creativeCatalog = {
  schemaVersion: 1 as const,
  themes: curatedThemes,
  auras: curatedAuras,
  transitions: curatedTransitions,
  songs: curatedSongs,
};

const catalogIntegrity = validateCreativeCatalogIntegrity();
if (!catalogIntegrity.ok) {
  throw new CreativeCatalogError("INVALID_CREATIVE_CATALOG", catalogIntegrity.issues.join(" "));
}
