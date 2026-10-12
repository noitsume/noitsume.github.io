import { consumeRateLimit } from "@/lib/http/rate-limit";
import "server-only";

import { extname } from "node:path";
import { createHash } from "node:crypto";
import {
  defaultBackgroundMusicMixPolicy,
  resolveTheme,
  roomMusicSchema,
  type BackgroundMusicSelection,
} from "@/lib/creative";
import type { Media, Room } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";
import {
  createIngestUploadUrl,
  createPrivateDownloadUrl,
  deletePrivateObjects,
  deletePrivatePrefixCompletely,
  headPrivateObject,
  writePrivateJson,
} from "@/lib/storage";
import { createId } from "@/lib/utils/id";
import { getOwnedRoom } from "@/lib/rooms";
import {
  directorGenerateRequestSchema,
  defaultSceneAtmosphere,
  roomMusicAnalysisInputSchema,
  roomMusicCommitRequestSchema,
  roomMusicUploadRequestSchema,
  roomStudioConfigSchema,
  selectDirectionRequestSchema,
  studioSettingsRequestSchema,
  type RoomMusicAnalysisInput,
  type RoomStudioConfig,
  type StoryAnchors,
  type StudioMediaSetting,
  type StudioSettingsRequest,
} from "./contracts";
import { compileAuthoredExperience, sectionProblems, upgradeStudioAuthoring } from "./authoring";
import { generateExperienceDirections } from "./director";
import { ensureWishIntelligence } from "./wish-intelligence";

export const ROOM_MUSIC_MAX_BYTES = 30 * 1024 * 1024;

function defaultAnchors(): StoryAnchors {
  return { opening: [], climax: [], ending: [] };
}

export function getRoomStudioConfig(room: Room): RoomStudioConfig {
  const raw = room.config && typeof room.config === "object" && !Array.isArray(room.config)
    ? (room.config as Record<string, unknown>).studio
    : null;
  const parsed = roomStudioConfigSchema.safeParse(raw);
  if (parsed.success) return upgradeStudioAuthoring(parsed.data);

  const theme = resolveTheme(room.themeId) ?? resolveTheme("theme_warm_memory");
  if (!theme) throw new ApiError("THEME_NOT_FOUND", "Tema Room tidak tersedia di Creative Catalog.", 500);
  return roomStudioConfigSchema.parse({
    schemaVersion: 1,
    authoringVersion: 2,
    selectedMedia: [],
    sectionPlan: [],
    storyAnchors: defaultAnchors(),
    storyAnchorsConfirmed: false,
    themeId: theme.id,
    backgroundMusic: null,
    wishIntelligence: {},
    directionCandidates: [],
    selectedDirectionId: null,
    updatedAt: room.updatedAt,
  });
}

async function persistStudio(room: Room, studio: RoomStudioConfig) {
  const currentConfig = room.config && typeof room.config === "object" && !Array.isArray(room.config)
    ? room.config as Record<string, unknown>
    : {};
  const updatedAt = new Date().toISOString();
  await backendRepositories.rooms.setConfig(room.id, { ...currentConfig, studio }, updatedAt, room.config);
  return { ...room, config: { ...currentConfig, studio }, updatedAt } satisfies Room;
}

function assertDraftVersion(room: Room, expected?: string) {
  if (expected && getRoomStudioConfig(room).updatedAt !== expected) throw new ApiError("STUDIO_CHANGED", "Studio sudah diubah di tab lain. Muat ulang sebelum melanjutkan.", 409);
}

function assertConfiguring(room: Room) {
  if (room.status !== "configuring") {
    throw new ApiError(
      "STUDIO_NOT_CONFIGURING",
      room.status === "collecting"
        ? "Tutup pengumpulan sebelum membuka Settings Studio."
        : "Settings Studio hanya dapat diubah saat Room berada di tahap Mengatur.",
      409,
    );
  }
}

function assertUniqueMediaSettings(settings: StudioMediaSetting[]) {
  const ids = new Set<string>();
  for (const setting of settings) {
    if (ids.has(setting.mediaId)) {
      throw new ApiError("DUPLICATE_MEDIA", "Media yang sama tidak boleh dipilih dua kali.", 400);
    }
    ids.add(setting.mediaId);
  }
}

function normalizeSelectedMedia(settings: StudioMediaSetting[], media: Media[]) {
  assertUniqueMediaSettings(settings);
  const mediaById = new Map(media.map((item) => [item.id, item]));

  return [...settings]
    .sort((a, b) => a.order - b.order)
    .map((setting, order) => {
      const item = mediaById.get(setting.mediaId);
      if (!item) throw new ApiError("MEDIA_NOT_FOUND", `Media ${setting.mediaId} tidak ada di inventori Room.`, 400);

      const duration = item.durationSec ?? item.technicalSignals?.durationSec ?? null;
      const trimInSec = setting.trimInSec ?? null;
      const trimOutSec = setting.trimOutSec ?? null;
      if (item.type === "photo" && (trimInSec !== null || trimOutSec !== null)) {
        throw new ApiError("PHOTO_TRIM_INVALID", "Foto tidak memiliki trim audio/video.", 400);
      }
      if (item.type === "video" && trimOutSec !== null && trimOutSec <= (trimInSec ?? 0)) {
        throw new ApiError("TRIM_INVALID", "Akhir potongan harus setelah awal video.", 400);
      }
      if (item.type === "video" && duration !== null) {
        if (trimInSec !== null && trimInSec >= duration) {
          throw new ApiError("TRIM_INVALID", "Trim awal harus berada sebelum akhir video.", 400);
        }
        if (trimOutSec !== null && trimOutSec > duration + 0.01) {
          throw new ApiError("TRIM_INVALID", "Trim akhir melewati durasi video.", 400);
        }
        if (trimInSec !== null && trimOutSec !== null && trimOutSec <= trimInSec) {
          throw new ApiError("TRIM_INVALID", "Trim akhir harus setelah trim awal.", 400);
        }
      }

      return {
        ...setting,
        order,
        volume: item.type === "photo" ? 0 : setting.volume,
        trimInSec: item.type === "photo" ? null : trimInSec,
        trimOutSec: item.type === "photo" ? null : trimOutSec,
        loop: item.type === "photo" ? false : setting.loop,
      };
    });
}

function assertAnchorsReferenceSelected(anchors: StoryAnchors, selectedIds: Set<string>) {
  for (const [role, ids] of Object.entries(anchors)) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!selectedIds.has(id)) {
        throw new ApiError("ANCHOR_MEDIA_NOT_SELECTED", `Story Anchor ${role} memakai media yang tidak dipilih.`, 400);
      }
      if (seen.has(id)) {
        throw new ApiError("DUPLICATE_ANCHOR", `Media Story Anchor ${role} terduplikasi.`, 400);
      }
      seen.add(id);
    }
  }
}

async function assertBackgroundMusic(room: Room, selection: BackgroundMusicSelection | null) {
  if (!selection) return;
  const roomMusic = await backendRepositories.roomMusic.getById(room.id, selection.musicId);
  if (!roomMusic) throw new ApiError("ROOM_MUSIC_NOT_FOUND", "Lagu upload Room tidak ditemukan.", 400);
  if (roomMusic.analysis.status !== "ready") {
    throw new ApiError("ROOM_MUSIC_NOT_ANALYZED", "Tekan Siapkan musik pada lagu yang diunggah sebelum melanjutkan.", 409);
  }
}

export async function startOwnedStudio(ownerUid: string, roomId: string) {
  const room = await getOwnedRoom(ownerUid, roomId);
  if (room.status === "collecting") {
    throw new ApiError("COLLECTION_STILL_OPEN", "Tutup pengumpulan sebelum masuk Settings Studio.", 409);
  }
  if (room.status === "baking") {
    throw new ApiError("ROOM_BAKING", "Room sedang dibake dan Settings Studio dikunci sementara.", 409);
  }
  if (room.status === "configuring") return room;
  if (room.status === "ready") {
    // Re-open Studio without touching the published Receiver snapshot.
    // The existing /r token remains live until the next successful Bake atomically replaces it.
    const updatedAt = new Date().toISOString();
    await backendRepositories.rooms.setStatus(room.id, "configuring", updatedAt);
    return { ...room, status: "configuring" as const, updatedAt };
  }

  const submissions = await backendRepositories.submissions.listByRoom(room.id);
  if (submissions.some((item) => item.status === "new")) {
    throw new ApiError("SUBMISSION_REVIEW_REQUIRED", "Selesaikan review semua submission sebelum masuk Studio.", 409);
  }

  const updatedAt = new Date().toISOString();
  await backendRepositories.rooms.setStatus(room.id, "configuring", updatedAt);
  return { ...room, status: "configuring" as const, updatedAt };
}

export async function saveOwnedStudioSettings(ownerUid: string, roomId: string, rawInput: StudioSettingsRequest) {
  const input = studioSettingsRequestSchema.parse(rawInput);
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  assertDraftVersion(room, input.expectedStudioUpdatedAt);

  const theme = resolveTheme(input.themeId);
  if (!theme) throw new ApiError("THEME_NOT_FOUND", "Theme tidak tersedia.", 400);

  const media = await backendRepositories.media.listByRoom(room.id);
  const selectedMedia = normalizeSelectedMedia(input.selectedMedia, media);
  const selectedIds = new Set(selectedMedia.map((item) => item.mediaId));
  assertAnchorsReferenceSelected(input.storyAnchors, selectedIds);
  await assertBackgroundMusic(room, input.backgroundMusic);

  const current = getRoomStudioConfig(room);
  const sectionPlan = (input.sectionPlan ?? current.sectionPlan).map((section, order) => ({ ...section, order }));
  const problems = sectionProblems({ selectedMedia, sectionPlan }, media, Boolean(input.preparePreview));
  if (problems.length) throw new ApiError("SECTION_INVALID", problems[0], 400);
  const musicIds = new Set(sectionPlan.flatMap(section => section.music ? [section.music.musicId] : []));
  await Promise.all([...musicIds].map(musicId => assertBackgroundMusic(room, { source: "room-upload", musicId })));

  const studio = roomStudioConfigSchema.parse({
    ...current,
    authoringVersion: 2,
    selectedMedia,
    sectionPlan,
    atmosphere: input.atmosphere ?? current.atmosphere ?? defaultSceneAtmosphere,
    storyAnchors: input.storyAnchors,
    storyAnchorsConfirmed: input.storyAnchorsConfirmed,
    themeId: theme.id,
    backgroundMusic: input.backgroundMusic,
    directionCandidates: [],
    selectedDirectionId: null,
    updatedAt: new Date().toISOString(),
  });
  if (input.preparePreview) {
    const experience = compileAuthoredExperience(studio, createId("direction"), studio.updatedAt);
    studio.directionCandidates = [experience];
    studio.selectedDirectionId = experience.id;
  }

  await persistStudio(room, studio);
  return { studio };
}

export async function selectOwnedDirection(ownerUid: string, roomId: string, rawInput: unknown) {
  const input = selectDirectionRequestSchema.parse(rawInput);
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  assertDraftVersion(room, input.expectedStudioUpdatedAt);
  const current = getRoomStudioConfig(room);
  if (!current.directionCandidates.some((item) => item.id === input.directionId)) {
    throw new ApiError("DIRECTION_NOT_FOUND", "Direction yang dipilih tidak tersedia.", 400);
  }
  const studio = roomStudioConfigSchema.parse({
    ...current,
    selectedDirectionId: input.directionId,
    updatedAt: new Date().toISOString(),
  });
  await persistStudio(room, studio);
  return { studio };
}

export async function setOwnedDirectionCandidates(
  ownerUid: string,
  roomId: string,
  directionCandidates: RoomStudioConfig["directionCandidates"],
) {
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  const current = getRoomStudioConfig(room);
  const studio = roomStudioConfigSchema.parse({
    ...current,
    directionCandidates,
    selectedDirectionId: null,
    updatedAt: new Date().toISOString(),
  });
  await persistStudio(room, studio);
  return { studio };
}

function normalizeMusicName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 100) || "Background Music";
}

export async function prepareOwnedRoomMusicUpload(ownerUid: string, roomId: string, rawInput: unknown) {
  const input = roomMusicUploadRequestSchema.parse(rawInput);
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  if (extname(input.fileName).toLowerCase() !== ".mp3") {
    throw new ApiError("MUSIC_EXTENSION_INVALID", "Background music upload harus berformat .mp3.", 400);
  }

  const musicId = createId("room_music");
  const objectKey = `rooms/${room.id}/music/${musicId}.mp3`;
  const uploadUrl = await createIngestUploadUrl({ objectKey, contentType: input.contentType, expiresInSeconds: 900 });
  return {
    musicId,
    objectKey,
    uploadUrl,
    name: input.name || normalizeMusicName(input.fileName),
  };
}

export async function commitOwnedRoomMusic(ownerUid: string, roomId: string, rawInput: unknown) {
  const input = roomMusicCommitRequestSchema.parse(rawInput);
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  const expectedKey = `rooms/${room.id}/music/${input.musicId}.mp3`;
  if (input.objectKey !== expectedKey) {
    throw new ApiError("INVALID_MUSIC_OBJECT_KEY", "Object key lagu tidak valid untuk Room ini.", 400);
  }

  let head;
  try {
    head = await headPrivateObject(input.objectKey);
  } catch {
    throw new ApiError("MUSIC_UPLOAD_MISSING", "File lagu belum ditemukan di storage.", 409);
  }
  if (Number(head.ContentLength ?? -1) !== input.sizeBytes) {
    throw new ApiError("MUSIC_SIZE_MISMATCH", "Ukuran file lagu di storage tidak cocok.", 409);
  }

  const now = new Date().toISOString();
  const item = roomMusicSchema.parse({
    schemaVersion: 1,
    id: input.musicId,
    roomId: room.id,
    name: input.name || normalizeMusicName(input.fileName),
    originalFileName: input.fileName,
    sizeBytes: input.sizeBytes,
    track: {
      id: `${input.musicId}-track`,
      source: "b2",
      storageObjectKey: input.objectKey,
      contentType: input.contentType,
    },
    beatmap: null,
    analysis: {
      status: "pending",
      version: null,
      failureCode: null,
      hash: null,
      durationSec: null,
      bpm: null,
      beats: [],
      onsets: [],
      energyCurve: [],
      mood: [],
      sections: { intro: null, build: null, peak: null, outro: null },
    },
    createdAt: now,
    updatedAt: now,
  });
  await backendRepositories.roomMusic.create(item);
  return { music: item };
}

export async function getOwnedRoomMusicDownloadUrl(ownerUid: string, roomId: string, musicId: string) {
  await getOwnedRoom(ownerUid, roomId);
  const item = await backendRepositories.roomMusic.getById(roomId, musicId);
  if (!item || item.track.source !== "b2") {
    throw new ApiError("ROOM_MUSIC_NOT_FOUND", "Lagu Room tidak ditemukan.", 404);
  }
  return {
    url: await createPrivateDownloadUrl({ objectKey: item.track.storageObjectKey, expiresInSeconds: 900 }),
  };
}

function validateMusicAnalysisTiming(input: RoomMusicAnalysisInput) {
  const duration = input.durationSec;
  if (input.features && (input.features.hash !== input.hash || Math.abs(input.features.durationSec - duration) > .001)) throw new ApiError("MUSIC_ANALYSIS_INVALID", "Identitas beatmap tidak sesuai audio.", 400);
  for (const times of [input.beats, input.onsets]) if (times.some((t, i) => i > 0 && t <= times[i - 1])) throw new ApiError("MUSIC_ANALYSIS_INVALID", "Waktu beatmap harus berurutan.", 400);
  for (const value of [...input.beats, ...input.onsets]) {
    if (value > duration + 0.05) {
      throw new ApiError("MUSIC_ANALYSIS_INVALID", "Beat/onset berada di luar durasi lagu.", 400);
    }
  }
  for (const range of Object.values(input.sections)) {
    if (range[0] > range[1] || range[1] > duration + 0.05) {
      throw new ApiError("MUSIC_ANALYSIS_INVALID", "Section beatmap lagu tidak valid.", 400);
    }
  }
}

export async function saveOwnedRoomMusicAnalysis(
  ownerUid: string,
  roomId: string,
  musicId: string,
  rawInput: unknown,
) {
  const analysisInput = roomMusicAnalysisInputSchema.parse(rawInput);
  validateMusicAnalysisTiming(analysisInput);
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  const item = await backendRepositories.roomMusic.getById(room.id, musicId);
  if (!item) throw new ApiError("ROOM_MUSIC_NOT_FOUND", "Lagu Room tidak ditemukan.", 404);

  const updatedAt = new Date().toISOString();
  const { features, ...summary } = analysisInput;
  let beatmap = item.beatmap;
  if (features) {
    const payload = { ...analysisInput, schemaVersion: 2 };
    const contentHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const key = `rooms/${room.id}/music/beatmaps/${musicId}/${contentHash}.json`;
    await writePrivateJson(key, payload);
    beatmap = { id: `${musicId}-${contentHash}`, source: "b2", storageObjectKey: key, contentType: "application/json" };
  }
  const updated = roomMusicSchema.parse({
    ...item,
    beatmap,
    analysis: {
      status: "ready",
      version: features ? "music-v2" : "music-v1",
      failureCode: null,
      ...summary,
    },
    updatedAt,
  });
  await backendRepositories.roomMusic.updateAnalysis(room.id, musicId, updated);
  return { music: updated };
}

export async function saveOwnedVideoBeatmap(ownerUid: string, roomId: string, mediaId: string, rawInput: unknown) {
  const room = await getOwnedRoom(ownerUid, roomId); assertConfiguring(room);
  const media = await backendRepositories.media.getById(room.id, mediaId);
  if (!media || media.type !== "video") throw new ApiError("MEDIA_NOT_FOUND", "Video Room tidak ditemukan.", 404);
  const input = roomMusicAnalysisInputSchema.parse(rawInput); validateMusicAnalysisTiming(input);
  if (!input.features) throw new ApiError("AUDIO_FEATURES_REQUIRED", "Siapkan beatmap rinci untuk video ini.", 400);
  const payload = { ...input, schemaVersion: 2 };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const key = `rooms/${room.id}/media-beatmaps/${media.id}/${hash}.json`;
  await writePrivateJson(key, payload);
  const audioBeatmap = { storageObjectKey: key, hash: input.hash, durationSec: input.durationSec, version: "music-v2" as const };
  await backendRepositories.media.updateAudioBeatmap(room.id, media.id, audioBeatmap);
  return { audioBeatmap };
}

export async function markOwnedRoomMusicAnalysisFailed(ownerUid: string, roomId: string, musicId: string) {
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  const item = await backendRepositories.roomMusic.getById(room.id, musicId);
  if (!item) throw new ApiError("ROOM_MUSIC_NOT_FOUND", "Lagu Room tidak ditemukan.", 404);
  const updated = roomMusicSchema.parse({
    ...item,
    analysis: { ...item.analysis, status: "fallback", version: "music-v1", failureCode: "analysis_failed" },
    updatedAt: new Date().toISOString(),
  });
  await backendRepositories.roomMusic.updateAnalysis(room.id, musicId, updated);
  return { music: updated };
}

export async function deleteOwnedRoomMusic(ownerUid: string, roomId: string, musicId: string) {
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  const item = await backendRepositories.roomMusic.getById(room.id, musicId);
  if (!item) return { deleted: false };
  const studio = getRoomStudioConfig(room);
  const published = room.receiverId ? await backendRepositories.receivers.getManifest(room.receiverId) : null;
  if (studio.backgroundMusic?.musicId === musicId || studio.sectionPlan.some(section => section.music?.musicId === musicId) || published?.assets.some(asset => asset.id.includes(musicId))) throw new ApiError("MUSIC_IN_USE", "Musik masih dipakai oleh draf atau cerita yang terbit. Lepaskan dari semua section dan terbitkan perubahan terlebih dahulu.", 409);
  await deletePrivateObjects([item.track, item.beatmap].flatMap(asset => asset?.source === "b2" ? [asset.storageObjectKey] : []));
  await deletePrivatePrefixCompletely(`rooms/${room.id}/music/beatmaps/${item.id}/`);
  await backendRepositories.roomMusic.delete(room.id, musicId);
  return { deleted: true };
}

export async function listOwnedRoomMusic(ownerUid: string, roomId: string) {
  await getOwnedRoom(ownerUid, roomId);
  return backendRepositories.roomMusic.listByRoom(roomId);
}

export function isStudioReadyForDirection(studio: RoomStudioConfig) {
  if (studio.authoringVersion === 2) return sectionProblems(studio).length === 0;
  return studio.selectedMedia.length > 0
    && studio.sectionPlan.length > 0
    && studio.storyAnchorsConfirmed
    && studio.backgroundMusic !== null;
}

export function isStudioReadyForBake(studio: RoomStudioConfig) {
  return isStudioReadyForDirection(studio)
    && Boolean(studio.selectedDirectionId)
    && studio.directionCandidates.some((item) => item.id === studio.selectedDirectionId);
}

export { defaultBackgroundMusicMixPolicy };

export async function generateOwnedExperienceDirections(ownerUid: string, roomId: string, rawInput: unknown) {
  const input = directorGenerateRequestSchema.parse(rawInput);
  const room = await getOwnedRoom(ownerUid, roomId);
  assertConfiguring(room);
  assertDraftVersion(room, input.expectedStudioUpdatedAt);
  const studio = getRoomStudioConfig(room);
  if (studio.authoringVersion === 2) {
    const experience = compileAuthoredExperience(studio, createId("direction"), new Date().toISOString());
    const next = { ...studio, directionCandidates: [experience], selectedDirectionId: experience.id, updatedAt: experience.generatedAt };
    await persistStudio(room, next);
    return { studio: next };
  }
  if (!isStudioReadyForDirection(studio) || !studio.backgroundMusic) {
    throw new ApiError(
      "STUDIO_DIRECTION_NOT_READY",
      "Selesaikan gate Media, Story Anchors (pilih atau lewati), dan Background Music sebelum generate direction.",
      409,
    );
  }

  const [media, submissions, roomMusic] = await Promise.all([
    backendRepositories.media.listByRoom(room.id),
    backendRepositories.submissions.listByRoom(room.id),
    studio.backgroundMusic.source === "room-upload"
      ? backendRepositories.roomMusic.getById(room.id, studio.backgroundMusic.musicId)
      : Promise.resolve(null),
  ]);

  if (studio.backgroundMusic.source === "room-upload" && (!roomMusic || roomMusic.analysis.status !== "ready")) {
    throw new ApiError("ROOM_MUSIC_NOT_ANALYZED", "Analyze background music sebelum generate direction.", 409);
  }

  const selectedIds = new Set(studio.selectedMedia.map((item) => item.mediaId));
  const selectedMedia = media.filter((item) => selectedIds.has(item.id));
  if (selectedMedia.length !== selectedIds.size) {
    throw new ApiError("STUDIO_MEDIA_CHANGED", "Sebagian media Studio sudah tidak tersedia. Pilih media ulang.", 409);
  }

  await consumeRateLimit("director:" + room.id, 20, 24 * 60 * 60 * 1000);
  const wishIntelligence = await ensureWishIntelligence(studio.wishIntelligence, submissions);
  const studioWithWishes = roomStudioConfigSchema.parse({
    ...studio,
    wishIntelligence,
    updatedAt: new Date().toISOString(),
  });
  const generationRoom = await persistStudio(room, studioWithWishes);

  const directionCandidates = await generateExperienceDirections({
    roomId: room.id,
    recipientName: room.recipientName,
    occasionId: room.occasionId,
    studio: studioWithWishes,
    media: selectedMedia,
    submissions,
    roomMusic,
    variantCount: input.variantCount,
  });
  const generatedStudio = roomStudioConfigSchema.parse({ ...studioWithWishes, directionCandidates, selectedDirectionId: null, updatedAt: new Date().toISOString() });
  await persistStudio(generationRoom, generatedStudio);
  return { studio: generatedStudio };
}
