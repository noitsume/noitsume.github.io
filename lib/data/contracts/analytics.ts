import { z } from "zod";

export const receiverAnalyticsEventSchema = z.object({
  id: z.string().min(1),
  receiverId: z.string().min(1),
  roomId: z.string().min(1),
  viewerKey: z.string().min(1),
  sessionId: z.string().min(1),
  type: z.enum(["open", "watch_threshold"]),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type ReceiverAnalyticsEvent = z.infer<
  typeof receiverAnalyticsEventSchema
>;
