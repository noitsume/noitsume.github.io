import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Fixed development fixture allowlist, never a user-supplied filesystem path. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const assets: Record<string, [string, string]> = {
    video: ["video-1.mp4", "video/mp4"],
    "music-background": ["music-background.mp3", "audio/mpeg"],
    "music-section": ["music-section.mp3", "audio/mpeg"],
  };
  const entry = assets[(await params).id];
  if (!entry) return new Response(null, { status: 404 });
  try { return new Response(await readFile(join(process.cwd(), "tmp/qa/authoring-assets", entry[0])), { headers: { "Content-Type": entry[1], "Cache-Control": "no-store" } }); }
  catch { return new Response("Local fixture unavailable", { status: 404 }); }
}
