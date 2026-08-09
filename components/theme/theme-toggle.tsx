"use client";

import { IconButton, MoonIcon, SunIcon } from "@/components/ui";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, isTransitioning, toggleTheme } = useTheme();

  return (
    <IconButton
      aria-label={theme === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
      className="theme-toggle"
      disabled={isTransitioning}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        void toggleTheme({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
    >
      <span className="theme-toggle__sun"><SunIcon size={19} /></span>
      <span className="theme-toggle__moon"><MoonIcon size={19} /></span>
    </IconButton>
  );
}
