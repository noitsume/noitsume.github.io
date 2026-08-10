import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiverExperience } from "@/components/receiver";
import { ApiError } from "@/lib/http";
import { getPublishedReceiver } from "@/lib/receiver";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ receiverId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { receiverId } = await params;
  try {
    const manifest = await getPublishedReceiver(receiverId);
    return {
      title: `${manifest.room.recipientName} · Kenangin.id`,
      description: `Sebuah kenangan untuk ${manifest.room.recipientName}.`,
    };
  } catch {
    return { title: "Receiver · Kenangin.id" };
  }
}

async function getReceiverOrNotFound(receiverId: string) {
  try {
    return await getPublishedReceiver(receiverId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function ReceiverPage({ params }: PageProps) {
  const { receiverId } = await params;
  const manifest = await getReceiverOrNotFound(receiverId);

  return <ReceiverExperience manifest={manifest} />;
}
