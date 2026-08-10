import type {
  ReceiverAssetRecord,
  ReceiverManifest,
  ReceiverManifestDraft,
} from "@/lib/data/contracts";

export type PublishReceiverSnapshotInput = {
  roomId: string;
  receiverId: string;
  manifest: ReceiverManifestDraft;
  assets: ReceiverAssetRecord[];
  bakedAt: string;
};

export interface ReceiverRepository {
  getManifest(receiverId: string): Promise<ReceiverManifest | null>;
  getAsset(receiverId: string, assetId: string): Promise<ReceiverAssetRecord | null>;
  publishSnapshot(input: PublishReceiverSnapshotInput): Promise<ReceiverManifest>;
}
