import { themeSchema, type Theme } from "@/lib/data/contracts";

const allOccasions = ["birthday", "graduation", "anniversary"];

const themes: Theme[] = [
  {
    schemaVersion: 1,
    id: "theme_warm_memory",
    name: "Warm Memory",
    description: "Hangat, intim, dan nostalgia seperti album kenangan yang hidup.",
    assets: {
      background: { id: "warm-bg", source: "public", publicPath: "/creative/themes/theme_warm_memory/background.svg", contentType: "image/svg+xml" },
      decorations: [
        { id: "warm-glow", source: "public", publicPath: "/creative/themes/theme_warm_memory/ornament-glow.svg", contentType: "image/svg+xml" },
        { id: "warm-leaf", source: "public", publicPath: "/creative/themes/theme_warm_memory/ornament-leaf.svg", contentType: "image/svg+xml" },
      ],
    },
    palette: { background: "#17110E", surface: "#241A15", primary: "#FF756F", accent: "#F4B35E", text: "#FFF5EA", muted: "#C7AA98" },
    anchors: [
      { id: "top-right", anchorX: 82, anchorY: 16, placement: "background", purpose: "ornament" },
      { id: "bottom-left", anchorX: 15, anchorY: 82, placement: "midground", purpose: "ornament" },
      { id: "copy-center", anchorX: 50, anchorY: 36, placement: "foreground", purpose: "copy-safe-zone" },
    ],
    ornaments: [
      { id: "glow", assetId: "warm-glow", anchorId: "top-right", scale: 1.15, opacity: 0.7 },
      { id: "leaf", assetId: "warm-leaf", anchorId: "bottom-left", scale: 0.9, opacity: 0.72 },
    ],
    typography: { displayFamily: "Georgia, serif", bodyFamily: "Inter, system-ui, sans-serif", displayWeight: 700, bodyWeight: 400, letterSpacingEm: -0.02 },
    motionPersonality: "gentle",
    themePersonality: ["warm", "nostalgic", "intimate"],
    compatibleAura: ["neutral", "memory-drift", "gentle-breath", "soft-rays", "warm-flare", "gentle-bokeh"],
    compatibleTransitions: ["soft-reveal", "memory-blur", "depth-push"],
    occasionIds: allOccasions,
  },
  {
    schemaVersion: 1,
    id: "theme_midnight_bloom",
    name: "Midnight Bloom",
    description: "Gelap elegan dengan aksen bunga dan pencahayaan sinematik yang intim.",
    assets: {
      background: { id: "midnight-bg", source: "public", publicPath: "/creative/themes/theme_midnight_bloom/background.svg", contentType: "image/svg+xml" },
      decorations: [
        { id: "midnight-bloom", source: "public", publicPath: "/creative/themes/theme_midnight_bloom/ornament-bloom.svg", contentType: "image/svg+xml" },
        { id: "midnight-star", source: "public", publicPath: "/creative/themes/theme_midnight_bloom/ornament-star.svg", contentType: "image/svg+xml" },
      ],
    },
    palette: { background: "#090A12", surface: "#141422", primary: "#BDA6FF", accent: "#F29CC3", text: "#F8F4FF", muted: "#9992B7" },
    anchors: [
      { id: "bloom-right", anchorX: 84, anchorY: 73, placement: "midground", purpose: "ornament" },
      { id: "star-left", anchorX: 18, anchorY: 22, placement: "background", purpose: "ornament" },
      { id: "copy-center", anchorX: 50, anchorY: 34, placement: "foreground", purpose: "copy-safe-zone" },
    ],
    ornaments: [
      { id: "bloom", assetId: "midnight-bloom", anchorId: "bloom-right", scale: 1.05, opacity: 0.84 },
      { id: "star", assetId: "midnight-star", anchorId: "star-left", scale: 0.8, opacity: 0.8 },
    ],
    typography: { displayFamily: "Georgia, serif", bodyFamily: "Inter, system-ui, sans-serif", displayWeight: 700, bodyWeight: 400, letterSpacingEm: 0 },
    motionPersonality: "cinematic",
    themePersonality: ["elegant", "intimate", "cinematic"],
    compatibleAura: ["neutral", "memory-drift", "gentle-breath", "cinematic-tilt", "soft-rays", "gentle-bokeh"],
    compatibleTransitions: ["soft-reveal", "memory-blur", "depth-push"],
    occasionIds: allOccasions,
  },
  {
    schemaVersion: 1,
    id: "theme_golden_celebration",
    name: "Golden Celebration",
    description: "Cerah dan penuh momentum untuk momen yang ingin terasa besar dan meriah.",
    assets: {
      background: { id: "gold-bg", source: "public", publicPath: "/creative/themes/theme_golden_celebration/background.svg", contentType: "image/svg+xml" },
      decorations: [
        { id: "gold-confetti", source: "public", publicPath: "/creative/themes/theme_golden_celebration/ornament-confetti.svg", contentType: "image/svg+xml" },
        { id: "gold-spark", source: "public", publicPath: "/creative/themes/theme_golden_celebration/ornament-spark.svg", contentType: "image/svg+xml" },
      ],
    },
    palette: { background: "#160F05", surface: "#281A08", primary: "#FFC857", accent: "#FF7A59", text: "#FFF8E5", muted: "#CBB98B" },
    anchors: [
      { id: "confetti-top", anchorX: 50, anchorY: 10, placement: "background", purpose: "ornament" },
      { id: "spark-right", anchorX: 86, anchorY: 50, placement: "midground", purpose: "ornament" },
      { id: "copy-center", anchorX: 50, anchorY: 40, placement: "foreground", purpose: "copy-safe-zone" },
    ],
    ornaments: [
      { id: "confetti", assetId: "gold-confetti", anchorId: "confetti-top", scale: 1.2, opacity: 0.92 },
      { id: "spark", assetId: "gold-spark", anchorId: "spark-right", scale: 0.95, opacity: 0.9 },
    ],
    typography: { displayFamily: "Arial Black, Inter, sans-serif", bodyFamily: "Inter, system-ui, sans-serif", displayWeight: 800, bodyWeight: 500, letterSpacingEm: -0.035 },
    motionPersonality: "energetic",
    themePersonality: ["celebratory", "joyful", "warm"],
    compatibleAura: ["neutral", "zoom-pulse", "celebration-particles", "warm-flare", "soft-rays"],
    compatibleTransitions: ["soft-reveal", "depth-push", "beat-cut"],
    occasionIds: allOccasions,
  },
  {
    schemaVersion: 1,
    id: "theme_paper_daydream",
    name: "Paper Daydream",
    description: "Ringan, playful, dan terasa handmade seperti scrapbook modern.",
    assets: {
      background: { id: "paper-bg", source: "public", publicPath: "/creative/themes/theme_paper_daydream/background.svg", contentType: "image/svg+xml" },
      decorations: [
        { id: "paper-tape", source: "public", publicPath: "/creative/themes/theme_paper_daydream/ornament-tape.svg", contentType: "image/svg+xml" },
        { id: "paper-doodle", source: "public", publicPath: "/creative/themes/theme_paper_daydream/ornament-doodle.svg", contentType: "image/svg+xml" },
      ],
    },
    palette: { background: "#F3E9D5", surface: "#FFF8E8", primary: "#E96B61", accent: "#5E9B8A", text: "#342A25", muted: "#8B756A" },
    anchors: [
      { id: "tape-left", anchorX: 16, anchorY: 16, placement: "foreground", purpose: "ornament" },
      { id: "doodle-right", anchorX: 84, anchorY: 74, placement: "background", purpose: "ornament" },
      { id: "media-center", anchorX: 50, anchorY: 54, placement: "foreground", purpose: "media-safe-zone" },
    ],
    ornaments: [
      { id: "tape", assetId: "paper-tape", anchorId: "tape-left", scale: 0.9, opacity: 0.78 },
      { id: "doodle", assetId: "paper-doodle", anchorId: "doodle-right", scale: 1, opacity: 0.72 },
    ],
    typography: { displayFamily: "Trebuchet MS, Inter, sans-serif", bodyFamily: "Inter, system-ui, sans-serif", displayWeight: 700, bodyWeight: 400, letterSpacingEm: -0.01 },
    motionPersonality: "playful",
    themePersonality: ["playful", "handmade", "soft"],
    compatibleAura: ["neutral", "memory-drift", "gentle-breath", "celebration-particles", "gentle-bokeh"],
    compatibleTransitions: ["soft-reveal", "memory-blur", "depth-push"],
    occasionIds: allOccasions,
  },
  {
    schemaVersion: 1,
    id: "theme_starlit_graduation",
    name: "Starlit Milestone",
    description: "Optimistis dan sinematik untuk pencapaian, wisuda, serta momen penuh kebanggaan.",
    assets: {
      background: { id: "starlit-bg", source: "public", publicPath: "/creative/themes/theme_starlit_graduation/background.svg", contentType: "image/svg+xml" },
      decorations: [
        { id: "starlit-arc", source: "public", publicPath: "/creative/themes/theme_starlit_graduation/ornament-arc.svg", contentType: "image/svg+xml" },
        { id: "starlit-stars", source: "public", publicPath: "/creative/themes/theme_starlit_graduation/ornament-stars.svg", contentType: "image/svg+xml" },
      ],
    },
    palette: { background: "#071522", surface: "#10263A", primary: "#76B9FF", accent: "#F4D35E", text: "#F4FAFF", muted: "#99B4C9" },
    anchors: [
      { id: "arc-bottom", anchorX: 50, anchorY: 84, placement: "background", purpose: "ornament" },
      { id: "stars-top", anchorX: 72, anchorY: 16, placement: "midground", purpose: "ornament" },
      { id: "copy-center", anchorX: 50, anchorY: 36, placement: "foreground", purpose: "copy-safe-zone" },
    ],
    ornaments: [
      { id: "arc", assetId: "starlit-arc", anchorId: "arc-bottom", scale: 1.1, opacity: 0.78 },
      { id: "stars", assetId: "starlit-stars", anchorId: "stars-top", scale: 0.8, opacity: 0.86 },
    ],
    typography: { displayFamily: "Georgia, serif", bodyFamily: "Inter, system-ui, sans-serif", displayWeight: 700, bodyWeight: 400, letterSpacingEm: 0.01 },
    motionPersonality: "cinematic",
    themePersonality: ["hopeful", "proud", "cinematic"],
    compatibleAura: ["neutral", "gentle-breath", "cinematic-tilt", "soft-rays", "warm-flare", "gentle-bokeh"],
    compatibleTransitions: ["soft-reveal", "depth-push", "beat-cut"],
    occasionIds: ["graduation", "birthday", "anniversary"],
  },
];

export const curatedThemes = themeSchema.array().parse(themes);
