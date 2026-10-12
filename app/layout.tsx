import type { Metadata, Viewport } from "next";
import { ThemeProvider, ThemeScript } from "@/components/theme";
import { brand } from "@/config/brand";
import { deskArrivalBootstrap } from "@/lib/dashboard/arrival";
import "./globals.css";
import "./production.css";
import "./aura-receiver.css";
import "./dashboard-workspace.css";

export const metadata: Metadata = {
  applicationName: brand.name,
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17130F" },
    { media: "(prefers-color-scheme: light)", color: "#F4F2ED" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script dangerouslySetInnerHTML={{ __html: deskArrivalBootstrap }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
