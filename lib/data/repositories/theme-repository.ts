import type { Theme } from "@/lib/data/contracts";

export interface ThemeRepository {
  listThemes(): Promise<Theme[]>;
  getTheme(id: string): Promise<Theme | null>;
}
