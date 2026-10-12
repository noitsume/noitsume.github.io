import { emptyAuraFrame, type AuraFrame } from "@/lib/audio/features";
/** Each depth owns a source and media clock. Video replaces section audio in front only. */
export type AuraSignals = { foreground: number; background: number; front?: AuraFrame; back?: AuraFrame; sample?: (now: number) => void };
export const newAuraSignals = (): AuraSignals => ({ foreground: 0, background: 0, front: emptyAuraFrame(), back: emptyAuraFrame() });
export const AURA_RENDERER_VERSION = "rintik-resonansi-v2" as const;

export function mediaFraming(type: string, width?: number | null, height?: number | null) {
  if (type === "text" || type === "hero") return "letter";
  if (!width || !height) return "landscape";
  return width / height < .85 ? "portrait" : width / height > 1.2 ? "landscape" : "square";
}

export function scenePose(index: number, reading: boolean, opened: boolean) {
  return { opening: opened ? 1 : 0, spread: reading ? 1 : .35, turn: (index % 5 - 2) * .15 };
}
