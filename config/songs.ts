import { songDefinitionSchema, type SongDefinition } from "@/lib/creative/contracts";
import { THEME_IDS } from "@/lib/creative/ids";

const allThemes = [...THEME_IDS];

const songs: SongDefinition[] = [
  {
    schemaVersion: 1,
    id: "song_afterglow",
    name: "Afterglow",
    artist: "Kenangin Originals",
    hash: "7d89cc662f46c0c3dbf2d1d6f1e3da5da3302d64f20f246e4a09fffdd1b275bd",
    track: { id: "afterglow-track", source: "public", publicPath: "/creative/songs/7d89cc662f46c0c3dbf2d1d6f1e3da5da3302d64f20f246e4a09fffdd1b275bd/track.wav", contentType: "audio/wav" },
    beatmap: { id: "afterglow-beatmap", source: "public", publicPath: "/creative/songs/7d89cc662f46c0c3dbf2d1d6f1e3da5da3302d64f20f246e4a09fffdd1b275bd/beatmap.json", contentType: "application/json" },
    durationSec: 18,
    bpm: 88,
    mood: ["warm", "nostalgic", "cinematic"],
    compatibleThemes: ["theme_warm_memory", "theme_midnight_bloom", "theme_paper_daydream", "theme_starlit_graduation"],
    sections: { intro: [0, 3.24], build: [3.24, 9.36], peak: [9.36, 14.76], outro: [14.76, 18] },
  },
  {
    schemaVersion: 1,
    id: "song_rise_together",
    name: "Rise Together",
    artist: "Kenangin Originals",
    hash: "ee472cb744494d875a26249cfae78334f0ba94ee3373d57ce57c9b84963f6ac0",
    track: { id: "rise-track", source: "public", publicPath: "/creative/songs/ee472cb744494d875a26249cfae78334f0ba94ee3373d57ce57c9b84963f6ac0/track.wav", contentType: "audio/wav" },
    beatmap: { id: "rise-beatmap", source: "public", publicPath: "/creative/songs/ee472cb744494d875a26249cfae78334f0ba94ee3373d57ce57c9b84963f6ac0/beatmap.json", contentType: "application/json" },
    durationSec: 18,
    bpm: 112,
    mood: ["uplifting", "celebratory", "bright"],
    compatibleThemes: ["theme_golden_celebration", "theme_starlit_graduation", "theme_paper_daydream"],
    sections: { intro: [0, 3.24], build: [3.24, 9.36], peak: [9.36, 14.76], outro: [14.76, 18] },
  },
  {
    schemaVersion: 1,
    id: "song_soft_horizon",
    name: "Soft Horizon",
    artist: "Kenangin Originals",
    hash: "30f4b44eecf5e0e43c3773abbe180b67362cb220b6db5bd9417610d494f944b1",
    track: { id: "horizon-track", source: "public", publicPath: "/creative/songs/30f4b44eecf5e0e43c3773abbe180b67362cb220b6db5bd9417610d494f944b1/track.wav", contentType: "audio/wav" },
    beatmap: { id: "horizon-beatmap", source: "public", publicPath: "/creative/songs/30f4b44eecf5e0e43c3773abbe180b67362cb220b6db5bd9417610d494f944b1/beatmap.json", contentType: "application/json" },
    durationSec: 18,
    bpm: 76,
    mood: ["intimate", "reflective", "tender"],
    compatibleThemes: allThemes,
    sections: { intro: [0, 3.24], build: [3.24, 9.36], peak: [9.36, 14.76], outro: [14.76, 18] },
  },
];

export const curatedSongs = songDefinitionSchema.array().parse(songs);
