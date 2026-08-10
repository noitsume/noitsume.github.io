export const COLLECTOR_MAX_FILES = 8;
export const COLLECTOR_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const COLLECTOR_MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const COLLECTOR_MAX_TOTAL_BYTES = 600 * 1024 * 1024;
export const COLLECTOR_MAX_MESSAGE_LENGTH = 3000;
export const COLLECTOR_MAX_NAME_LENGTH = 80;

export const collectorMediaRules = {
  "image/jpeg": { type: "photo", extensions: [".jpg", ".jpeg"] },
  "image/png": { type: "photo", extensions: [".png"] },
  "image/webp": { type: "photo", extensions: [".webp"] },
  "video/mp4": { type: "video", extensions: [".mp4"] },
  "video/webm": { type: "video", extensions: [".webm"] },
  "video/quicktime": { type: "video", extensions: [".mov"] },
} as const;

export type CollectorContentType = keyof typeof collectorMediaRules;
export type CollectorMediaType = (typeof collectorMediaRules)[CollectorContentType]["type"];

export const COLLECTOR_ACCEPT = Object.keys(collectorMediaRules).join(",");
