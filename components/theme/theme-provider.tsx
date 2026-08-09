"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

export type ThemeMode = "light" | "dark";
type LampState = "on" | "off" | "flicker-on" | "flicker-off";

type TransitionOrigin = { x: number; y: number };

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

type ThemeContextValue = {
  theme: ThemeMode;
  isTransitioning: boolean;
  toggleTheme: (origin: TransitionOrigin) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "kenangin-theme";
const REVEAL_DURATION = 680;
const LAMP_FLICKER_DURATION = 820;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function getRevealRadius(x: number, y: number) {
  const maxX = Math.max(x, window.innerWidth - x);
  const maxY = Math.max(y, window.innerHeight - y);
  return Math.hypot(maxX, maxY);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getDocumentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const setLampState = useCallback((state: LampState) => {
    document.documentElement.dataset.lamps = state;
  }, []);

  const commitTheme = useCallback((nextTheme: ThemeMode) => {
    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Theme still works when storage is unavailable (private/locked contexts).
    }

    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const current = getDocumentTheme();
      setTheme(current);
      setLampState(current === "dark" ? "on" : "off");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [setLampState]);

  const fallbackReveal = useCallback(
    async (nextTheme: ThemeMode, { x, y }: TransitionOrigin) => {
      const radius = getRevealRadius(x, y);
      const overlay = document.createElement("div");
      overlay.className = "theme-fallback-reveal";
      overlay.style.left = `${x - radius}px`;
      overlay.style.top = `${y - radius}px`;
      overlay.style.width = `${radius * 2}px`;
      overlay.style.height = `${radius * 2}px`;
      overlay.style.background = nextTheme === "dark" ? "#17130F" : "#F4F2ED";
      document.body.appendChild(overlay);

      const animation = overlay.animate(
        [
          { transform: "scale(0)", opacity: 1 },
          { transform: "scale(1)", opacity: 1 },
        ],
        {
          duration: REVEAL_DURATION,
          easing: "cubic-bezier(.72,0,.18,1)",
          fill: "forwards",
        },
      );

      try {
        await animation.finished;
      } catch {
        // The theme still commits if the animation is interrupted.
      }

      commitTheme(nextTheme);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      overlay.remove();
    },
    [commitTheme],
  );

  const revealTheme = useCallback(
    async (nextTheme: ThemeMode, origin: TransitionOrigin) => {
      if (prefersReducedMotion()) {
        commitTheme(nextTheme);
        return;
      }

      const doc = document as ViewTransitionDocument;
      if (!doc.startViewTransition) {
        await fallbackReveal(nextTheme, origin);
        return;
      }

      const { x, y } = origin;
      const radius = getRevealRadius(x, y);
      const transition = doc.startViewTransition(() => {
        flushSync(() => commitTheme(nextTheme));
      });

      try {
        await transition.ready;
        const options: KeyframeAnimationOptions & { pseudoElement: string } = {
          duration: REVEAL_DURATION,
          easing: "cubic-bezier(.72,0,.18,1)",
          fill: "both",
          pseudoElement: "::view-transition-new(root)",
        };

        const animation = document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          options,
        );

        await Promise.allSettled([animation.finished, transition.finished]);
      } catch {
        // Browser-specific interruption: the DOM state is already committed.
      }
    },
    [commitTheme, fallbackReveal],
  );

  const toggleTheme = useCallback(
    async (origin: TransitionOrigin) => {
      if (isTransitioning) return;

      setIsTransitioning(true);
      document.documentElement.dataset.themeTransitioning = "true";

      try {
        // Read the DOM attribute here rather than relying only on hydrated state.
        // ThemeScript writes this before first paint, so a very fast click is safe.
        const currentTheme = getDocumentTheme();

        if (currentTheme === "light") {
          // Light → Dark: circle reveal first, then the lamps wake/flicker and settle.
          setLampState("off");
          await revealTheme("dark", origin);

          if (prefersReducedMotion()) {
            setLampState("on");
          } else {
            setLampState("flicker-on");
            await sleep(LAMP_FLICKER_DURATION);
            setLampState("on");
          }
        } else {
          // Dark → Light: lamps flicker out completely before the light reveal begins.
          if (prefersReducedMotion()) {
            setLampState("off");
          } else {
            setLampState("flicker-off");
            await sleep(LAMP_FLICKER_DURATION);
            setLampState("off");
            await sleep(90);
          }

          await revealTheme("light", origin);
        }
      } finally {
        delete document.documentElement.dataset.themeTransitioning;
        setTheme(getDocumentTheme());
        setIsTransitioning(false);
      }
    },
    [isTransitioning, revealTheme, setLampState],
  );

  const value = useMemo(
    () => ({ theme, isTransitioning, toggleTheme }),
    [theme, isTransitioning, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
