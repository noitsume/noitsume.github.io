import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeAnchorTool } from "@/components/dev/theme-anchor-tool";
import { curatedThemes } from "@/config/themes";

export const metadata: Metadata = { title: "Theme Anchor Tool · Dev" };

export default function ThemeAnchorPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ThemeAnchorTool themes={curatedThemes} />;
}
