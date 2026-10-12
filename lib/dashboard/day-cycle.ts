export type DeskAtmosphere = { day: number; night: number; active: boolean };
export type DeskDayMode = "light" | "dark";

export const DAY_CYCLE_COMMIT = .82;
export const DAY_CYCLE_DURATION = { light: 4.6, dark: 3.4 } as const;

const smooth = (time: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** One clock drives physical light, the soft aperture, and accessible HTML. */
export function sampleDeskDayCycle(time: number, to: DeskDayMode) {
  const morning = to === "light";
  const blackout = smooth(time, 0, .7);
  const spread = smooth(time, 1.02, morning ? 3.75 : 2.7);
  const daylight = morning ? smooth(time, 1.02, 3.5) : 1 - blackout;
  const night = morning ? 1 - blackout : smooth(time, 1.02, 2.65);
  const ui = 1 - blackout + smooth(time, morning ? 3.35 : 2.45, DAY_CYCLE_DURATION[to]);
  const cover = blackout * (1 - smooth(time, morning ? 3.55 : 2.5, morning ? 4.15 : 3.05));
  const glow = smooth(time, 1.02, 1.8) * (1 - smooth(time, morning ? 2.5 : 2.05, morning ? 4.1 : 3.05));
  return { day: daylight, night, spread, ui, cover, glow, committed: time >= DAY_CYCLE_COMMIT };
}
