import { z } from "zod";

export const eventDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().datetime(),
  category: z.string().min(1),
  icon: z.string().min(1),
  accent: z.string().min(1),
  region: z.string().min(1),
});

export type EventDefinition = z.infer<typeof eventDefinitionSchema>;
