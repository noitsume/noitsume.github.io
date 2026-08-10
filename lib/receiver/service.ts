import "server-only";

import { randomBytes } from "node:crypto";
import {
  assertCreativeSelection,
  resolveSong,
  resolveTheme,
  type CreativeAssetReference,
  type RoomMusic,
} from "@/lib/creative";
import {
  receiverAssetRecordSchema,
  receiverManifestSchema,
  type Media,
  type ReceiverAssetDescriptor,
  type ReceiverAssetRecord,
  type ReceiverManifest,
  type ReceiverManifestDraft,
  type ReceiverMediaDescriptor,
  type ReceiverWish,
  type Room,
  type Submission,
} from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";
import { createPrivateDownloadUrl, headPrivateObject } from "@/lib/storage";
import {
  experienceDnaSchema,
  type ExperienceDNA,
  type RoomStudioConfig,
} from "@/lib/studio/contracts";
import { getRoomStudioConfig, isStudioReadyForBake } from "@/lib/studio/service";

function createReceiverId() {
  return `receiver_${randomBytes(10).toString("hex")}`;
}

function assetId(...parts: string[]) {
  return parts.join("_").replace(/[^A-Za-z0-9_-]/g, "_");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function assertExperienceReferencesSelectedMedia(experience: ExperienceDNA, studio: RoomStudioConfig) {
  const selected = new Set(studio.selectedMedia.map((item) => item.mediaId));
  const referencedIds: string[] = [];
  const sectionIds = new Set<string>();

  for (const section of experience.sections) {
    if (sectionIds.has(section.id)) {
      throw new ApiError("DUPLICATE_EXPERIENCE_SECTION", `Section ${section.id} terduplikasi.`, 409);
    }
    sectionIds.add(section.id);
    for (const id of section.mediaIds) referencedIds.push(id);
  }

  const referenced = new Set(referencedIds);
  if (referencedIds.length !== referenced.size) {
    throw new ApiError("DUPLICATE_EXPERIENCE_MEDIA", "Satu media dipakai lebih dari sekali pada execution plan final.", 409);
  }
  if (!setsEqual(selected, referenced)) {
    throw new ApiError(
      "EXPERIENCE_MEDIA_MISMATCH",
      "ExperienceDNA tidak lagi cocok dengan media pilihan Studio. Generate direction ulang sebelum Bake.",
      409,
    );
  }
}

function assertCreativeReferences(experience: ExperienceDNA) {
  const auraIds = unique(experience.sections.flatMap((section) => section.auraIds));
  const transitionIds = unique(
    experience.sections.flatMap((section) => [section.transitionInId, section.transitionOutId].filter(Boolean)),
  );
  const result = assertCreativeSelection({
    themeId: experience.themeId,
    backgroundMusic: experience.backgroundMusic,
    auraIds,
    transitionIds,
  });
  return result;
}

function publicWishes(submissions: Submission[]) {
  return submissions
    .filter((item) => item.status === "approved" && Boolean(item.message?.trim()))
    .map((item): ReceiverWish => ({
      id: item.id,
      text: item.message!.trim(),
      contributorName: item.contributorName?.trim() || null,
    }));
}

function buildThemeSnapshot(
  receiverId: string,
  theme: NonNullable<ReturnType<typeof resolveTheme>>,
  assets: ReceiverAssetRecord[],
  descriptors: ReceiverAssetDescriptor[],
) {
  const assetMap = new Map<string, string>();

  function addThemeAsset(source: CreativeAssetReference, kind: "theme-background" | "theme-decoration") {
    const id = assetId("asset", kind, theme.id, source.id);
    assetMap.set(source.id, id);
    descriptors.push({
      id,
      kind,
      contentType: source.contentType,
      delivery: source.source === "public" ? "public" : "resolver",
      publicPath: source.source === "public" ? source.publicPath : null,
      mediaId: null,
    });
    assets.push(receiverAssetRecordSchema.parse(source.source === "public" ? {
      id,
      receiverId,
      kind,
      contentType: source.contentType,
      source: "public",
      publicPath: source.publicPath,
      mediaId: null,
    } : {
      id,
      receiverId,
      kind,
      contentType: source.contentType,
      source: "b2",
      storageObjectKey: source.storageObjectKey,
      mediaId: null,
    }));
    return id;
  }

  const backgroundAssetId = addThemeAsset(theme.assets.background, "theme-background");
  for (const decoration of theme.assets.decorations) addThemeAsset(decoration, "theme-decoration");
  const anchorById = new Map(theme.anchors.map((anchor) => [anchor.id, anchor]));

  return {
    id: theme.id,
    name: theme.name,
    palette: theme.palette,
    typography: theme.typography,
    backgroundAssetId,
    decorations: theme.ornaments.map((ornament) => {
      const anchor = anchorById.get(ornament.anchorId);
      const receiverAssetId = assetMap.get(ornament.assetId);
      if (!anchor || !receiverAssetId) {
        throw new ApiError("THEME_ASSET_INVALID", `Theme ${theme.id} memiliki ornament yang tidak dapat di-resolve.`, 500);
      }
      return {
        id: ornament.id,
        assetId: receiverAssetId,
        anchorX: anchor.anchorX,
        anchorY: anchor.anchorY,
        scale: ornament.scale,
        opacity: ornament.opacity,
        placement: anchor.placement,
      };
    }),
  };
}

function addMediaAssets(
  receiverId: string,
  selectedMedia: Media[],
  assets: ReceiverAssetRecord[],
  descriptors: ReceiverAssetDescriptor[],
): ReceiverMediaDescriptor[] {
  return selectedMedia.map((item) => {
    const id = assetId("asset", "media", item.id);
    descriptors.push({
      id,
      kind: "media",
      contentType: item.contentType,
      delivery: "resolver",
      publicPath: null,
      mediaId: item.id,
    });
    assets.push(receiverAssetRecordSchema.parse({
      id,
      receiverId,
      kind: "media",
      contentType: item.contentType,
      source: "b2",
      storageObjectKey: item.storageObjectKey,
      mediaId: item.id,
    }));
    return {
      id: item.id,
      assetId: id,
      type: item.type,
      contentType: item.contentType,
      width: item.width ?? item.technicalSignals?.width ?? null,
      height: item.height ?? item.technicalSignals?.height ?? null,
      durationSec: item.durationSec ?? item.technicalSignals?.durationSec ?? null,
      contributorName: item.contributorName?.trim() || null,
      originalFileName: item.originalFileName,
    };
  });
}

function addCreativeAsset(
  receiverId: string,
  source: CreativeAssetReference,
  kind: "music" | "beatmap",
  id: string,
  assets: ReceiverAssetRecord[],
  descriptors: ReceiverAssetDescriptor[],
) {
  descriptors.push({
    id,
    kind,
    contentType: source.contentType,
    delivery: source.source === "public" ? "public" : "resolver",
    publicPath: source.source === "public" ? source.publicPath : null,
    mediaId: null,
  });
  assets.push(receiverAssetRecordSchema.parse(source.source === "public" ? {
    id,
    receiverId,
    kind,
    contentType: source.contentType,
    source: "public",
    publicPath: source.publicPath,
    mediaId: null,
  } : {
    id,
    receiverId,
    kind,
    contentType: source.contentType,
    source: "b2",
    storageObjectKey: source.storageObjectKey,
    mediaId: null,
  }));
}

function buildMusicSnapshot(
  receiverId: string,
  studio: RoomStudioConfig,
  roomMusic: RoomMusic | null,
  assets: ReceiverAssetRecord[],
  descriptors: ReceiverAssetDescriptor[],
) {
  const selection = studio.backgroundMusic;
  if (!selection) throw new ApiError("BACKGROUND_MUSIC_REQUIRED", "Background music belum dipilih.", 409);

  if (selection.source === "catalog") {
    const song = resolveSong(selection.songId);
    if (!song) throw new ApiError("SONG_NOT_FOUND", "Template background music tidak tersedia.", 409);
    const trackAssetId = assetId("asset", "music", song.id, "track");
    const beatmapAssetId = assetId("asset", "music", song.id, "beatmap");
    addCreativeAsset(receiverId, song.track, "music", trackAssetId, assets, descriptors);
    addCreativeAsset(receiverId, song.beatmap, "beatmap", beatmapAssetId, assets, descriptors);
    return {
      name: song.name,
      trackAssetId,
      bpm: song.bpm,
      durationSec: song.durationSec,
      mood: song.mood,
      beatmapSource: "asset" as const,
      beatmapAssetId,
      beats: [],
      onsets: [],
      energyCurve: [],
    };
  }

  if (!roomMusic || roomMusic.id !== selection.musicId || roomMusic.analysis.status !== "ready") {
    throw new ApiError("ROOM_MUSIC_NOT_READY", "Background music upload belum selesai dianalisis.", 409);
  }
  const trackAssetId = assetId("asset", "music", roomMusic.id, "track");
  addCreativeAsset(receiverId, roomMusic.track, "music", trackAssetId, assets, descriptors);
  return {
    name: roomMusic.name,
    trackAssetId,
    bpm: roomMusic.analysis.bpm,
    durationSec: roomMusic.analysis.durationSec,
    mood: roomMusic.analysis.mood,
    beatmapSource: "inline" as const,
    beatmapAssetId: null,
    beats: roomMusic.analysis.beats,
    onsets: roomMusic.analysis.onsets,
    energyCurve: roomMusic.analysis.energyCurve,
  };
}

async function verifyPrivateAssets(media: Media[], roomMusic: RoomMusic | null) {
  const checks = media.map(async (item) => {
    const head = await headPrivateObject(item.storageObjectKey);
    if (Number(head.ContentLength ?? -1) !== item.sizeBytes) {
      throw new ApiError("MEDIA_STORAGE_MISMATCH", `Media ${item.id} di storage tidak lagi cocok dengan metadata.`, 409);
    }
  });
  const roomMusicTrack = roomMusic?.track;
  if (roomMusic && roomMusicTrack?.source === "b2") {
    const storageObjectKey = roomMusicTrack.storageObjectKey;
    const expectedSizeBytes = roomMusic.sizeBytes;
    checks.push((async () => {
      const head = await headPrivateObject(storageObjectKey);
      if (Number(head.ContentLength ?? -1) !== expectedSizeBytes) {
        throw new ApiError("MUSIC_STORAGE_MISMATCH", "Background music di storage tidak lagi cocok dengan metadata.", 409);
      }
    })());
  }
  await Promise.all(checks);
}

function selectedExperience(studio: RoomStudioConfig) {
  if (!isStudioReadyForBake(studio) || !studio.selectedDirectionId) {
    throw new ApiError("BAKE_NOT_READY", "Pilih satu ExperienceDNA final sebelum Bake.", 409);
  }
  const raw = studio.directionCandidates.find((item) => item.id === studio.selectedDirectionId);
  if (!raw) throw new ApiError("DIRECTION_NOT_FOUND", "ExperienceDNA final tidak ditemukan.", 409);
  return experienceDnaSchema.parse(raw);
}

export async function bakeOwnedReceiver(ownerUid: string, roomId: string) {
  let room = await getOwnedRoom(ownerUid, roomId);
  if (room.status === "collecting" || room.status === "closed") {
    throw new ApiError("ROOM_NOT_CONFIGURED", "Selesaikan Settings Studio sebelum Bake.", 409);
  }
  if (room.status === "ready") {
    const published = room.receiverId ? await backendRepositories.receivers.getManifest(room.receiverId) : null;
    if (published) return { room, manifest: published, reused: true };
    throw new ApiError("RECEIVER_SNAPSHOT_MISSING", "Room berstatus selesai tetapi snapshot Receiver tidak ditemukan.", 409);
  }
  if (room.status !== "configuring" && room.status !== "baking") {
    throw new ApiError("ROOM_NOT_BAKEABLE", "Room belum siap untuk Bake.", 409);
  }

  const studio = getRoomStudioConfig(room);
  const experience = selectedExperience(studio);
  assertExperienceReferencesSelectedMedia(experience, studio);
  if (experience.themeId !== studio.themeId || room.themeId !== studio.themeId) {
    throw new ApiError("THEME_CHANGED", "Theme Room berubah setelah direction dibuat. Generate direction ulang.", 409);
  }
  assertCreativeReferences(experience);

  const [allMedia, submissions, roomMusic] = await Promise.all([
    backendRepositories.media.listByRoom(room.id),
    backendRepositories.submissions.listByRoom(room.id),
    studio.backgroundMusic?.source === "room-upload"
      ? backendRepositories.roomMusic.getById(room.id, studio.backgroundMusic.musicId)
      : Promise.resolve(null),
  ]);
  const mediaById = new Map(allMedia.map((item) => [item.id, item]));
  const selectedMedia = [...studio.selectedMedia]
    .sort((a, b) => a.order - b.order)
    .map((setting) => mediaById.get(setting.mediaId))
    .filter((item): item is Media => Boolean(item));
  if (selectedMedia.length !== studio.selectedMedia.length) {
    throw new ApiError("MEDIA_MISSING", "Sebagian media pilihan sudah tidak tersedia. Kembali ke Studio dan generate ulang.", 409);
  }

  const wishes = publicWishes(submissions);
  const wishIds = new Set(wishes.map((item) => item.id));
  const referencedWishIds = unique(experience.sections.flatMap((section) => section.wishIds));
  const missingWish = referencedWishIds.find((id) => !wishIds.has(id));
  if (missingWish) {
    throw new ApiError("WISH_MISSING", "Ucapan yang dipakai ExperienceDNA sudah berubah. Generate direction ulang.", 409);
  }

  const theme = resolveTheme(studio.themeId);
  if (!theme) throw new ApiError("THEME_NOT_FOUND", "Theme final tidak tersedia di Creative Catalog.", 409);
  await verifyPrivateAssets(selectedMedia, roomMusic);

  const receiverId = room.receiverId ?? createReceiverId();
  const assets: ReceiverAssetRecord[] = [];
  const descriptors: ReceiverAssetDescriptor[] = [];
  const themeSnapshot = buildThemeSnapshot(receiverId, theme, assets, descriptors);
  const media = addMediaAssets(receiverId, selectedMedia, assets, descriptors);
  const music = buildMusicSnapshot(receiverId, studio, roomMusic, assets, descriptors);

  const draft: ReceiverManifestDraft = {
    schemaVersion: 1,
    receiverId,
    room: {
      id: room.id,
      title: room.title,
      recipientName: room.recipientName,
      occasionId: room.occasionId,
    },
    theme: themeSnapshot,
    assets: descriptors,
    media,
    wishes,
    music,
    experience,
  };

  const bakedAt = new Date().toISOString();
  if (room.status !== "baking") {
    await backendRepositories.rooms.setStatus(room.id, "baking", bakedAt);
    room = { ...room, status: "baking", updatedAt: bakedAt };
  }

  try {
    const manifest = await backendRepositories.receivers.publishSnapshot({
      roomId: room.id,
      receiverId,
      manifest: draft,
      assets,
      bakedAt,
    });
    const finalRoom: Room = {
      ...room,
      receiverId,
      status: "ready",
      firstBakedAt: room.firstBakedAt ?? bakedAt,
      lastBakedAt: bakedAt,
      updatedAt: bakedAt,
    };
    return { room: finalRoom, manifest, reused: false };
  } catch (error) {
    const failedAt = new Date().toISOString();
    await backendRepositories.rooms.setStatus(room.id, "configuring", failedAt).catch(() => undefined);
    throw error;
  }
}

export async function getPublishedReceiver(receiverId: string): Promise<ReceiverManifest> {
  const manifest = await backendRepositories.receivers.getManifest(receiverId);
  if (!manifest) throw new ApiError("RECEIVER_NOT_FOUND", "Receiver tidak ditemukan.", 404);
  return receiverManifestSchema.parse(manifest);
}

export async function resolvePublishedReceiverAsset(receiverId: string, assetIdValue: string) {
  const manifest = await getPublishedReceiver(receiverId);
  if (!manifest.assets.some((asset) => asset.id === assetIdValue)) {
    throw new ApiError("RECEIVER_ASSET_NOT_FOUND", "Asset tidak termasuk dalam snapshot Receiver aktif.", 404);
  }
  const asset = await backendRepositories.receivers.getAsset(receiverId, assetIdValue);
  if (!asset) throw new ApiError("RECEIVER_ASSET_NOT_FOUND", "Asset Receiver tidak ditemukan.", 404);

  if (asset.source === "public") {
    return { source: "public" as const, path: asset.publicPath, contentType: asset.contentType };
  }
  return {
    source: "b2" as const,
    url: await createPrivateDownloadUrl({ objectKey: asset.storageObjectKey, expiresInSeconds: 300 }),
    contentType: asset.contentType,
  };
}
