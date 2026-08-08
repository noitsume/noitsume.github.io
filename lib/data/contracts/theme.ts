import { z } from "zod";

export const themeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  backgroundUrl: z.string(),
  palette: z.object({
    primary: z.string().min(1),
    accent: z.string().min(1),
    surface: z.string().min(1),
  }),
  ornaments: z.array(
    z.object({
      svgUrl: z.string(),
      anchorX: z.number(),
      anchorY: z.number(),
    }),
  ),
  occasionIds: z.array(z.string().min(1)).default([]),
});

export type Theme = z.infer<typeof themeSchema>;
