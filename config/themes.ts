import type { Theme } from "@/lib/data/contracts";

// Theme catalog is developer-curated configuration, not Firestore user data.
// Patch 7 will expand this into the final MVP catalog and real B2 asset URLs.
export const curatedThemes: Theme[] = [
  {
    id: "theme_warm_memory",
    name: "Warm Memory",
    backgroundUrl: "",
    palette: {
      primary: "#FF6161",
      accent: "#F2A63D",
      surface: "#211B16",
    },
    ornaments: [],
    occasionIds: ["birthday", "graduation", "anniversary"],
  },
];
