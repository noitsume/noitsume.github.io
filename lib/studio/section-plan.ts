import type { Media } from "@/lib/data/contracts";
import { studioSectionPlanSchema, type StudioMediaSetting, type StudioSectionPlan } from "./contracts";

export function buildStudioSectionPlan(
  settings: StudioMediaSetting[],
  media: Media[],
): StudioSectionPlan[] {
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const ordered = [...settings].sort((a, b) => a.order - b.order);
  const photos = ordered.filter((setting) => mediaById.get(setting.mediaId)?.type === "photo");
  const firstPhotoOrder = photos[0]?.order ?? Number.POSITIVE_INFINITY;
  const plan: StudioSectionPlan[] = [];

  for (const setting of ordered) {
    const item = mediaById.get(setting.mediaId);
    if (!item || item.type !== "video") continue;
    plan.push(studioSectionPlanSchema.parse({
      id: `section_video_${item.id.replace(/[^A-Za-z0-9_-]/g, "_")}`,
      type: "video",
      mediaIds: [item.id],
      order: setting.order,
    }));
  }

  if (photos.length > 0) {
    plan.push(studioSectionPlanSchema.parse({
      id: "section_photo_slide",
      type: "photo-slide",
      mediaIds: photos.map((item) => item.mediaId),
      order: firstPhotoOrder,
    }));
  }

  return plan
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index }));
}
