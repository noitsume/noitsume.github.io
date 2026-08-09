const themeBootstrap = `
(() => {
  try {
    const stored = localStorage.getItem("kenangin-theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : (systemDark ? "dark" : "light");
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.lamps = theme === "dark" ? "on" : "off";
    root.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.lamps = "on";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />;
}
