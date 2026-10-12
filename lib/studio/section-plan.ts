import type { Media } from "@/lib/data/contracts";
import type { StudioMediaSetting, StudioSectionPlan } from "./contracts";
import { emptySection } from "./authoring";

// This is an explicit recommendation, never an automatic side effect of saving.
// Consecutive photos share a slider; videos retain their own spotlight and order.
export function buildStudioSectionPlan(settings: StudioMediaSetting[], media: Media[]): StudioSectionPlan[] {
  const byId = new Map(media.map(item => [item.id, item]));
  const result: StudioSectionPlan[] = [];
  for (const setting of [...settings].sort((a, b) => a.order - b.order)) {
    const item = byId.get(setting.mediaId);
    if (!item) continue;
    const last = result.at(-1);
    if (item.type === "photo" && last?.type === "photo-slide" && last.mediaIds.length < 5) last.mediaIds.push(item.id);
    else result.push({ ...emptySection(item.type === "video" ? "video" : "photo-slide", `section_${item.id.replace(/[^A-Za-z0-9_-]/g, "_")}`, result.length), mediaIds: [item.id] });
  }
  return result.map(section => section.type === "photo-slide" && section.mediaIds.length === 1 ? { ...section, type: "photo" } : section);
}
