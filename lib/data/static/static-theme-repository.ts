import { curatedThemes } from "@/config/themes";
import type { Theme } from "@/lib/data/contracts";
import type { ThemeRepository } from "@/lib/data/repositories";

export class StaticThemeRepository implements ThemeRepository {
  async listThemes(): Promise<Theme[]> {
    return curatedThemes.map((theme) => structuredClone(theme));
  }

  async getTheme(id: string): Promise<Theme | null> {
    const theme = curatedThemes.find((candidate) => candidate.id === id);
    return theme ? structuredClone(theme) : null;
  }
}
