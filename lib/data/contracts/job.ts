import { z } from "zod";

/**
 * Patch 8 removed the legacy BakeJob/render-queue contract.
 * Bake is synchronous deterministic publication; these stages exist only for UI/progress reporting.
 */
export const bakeProgressStageSchema = z.enum([
  "preflight",
  "manifest",
  "publish",
  "complete",
]);

export type BakeProgressStage = z.infer<typeof bakeProgressStageSchema>;
