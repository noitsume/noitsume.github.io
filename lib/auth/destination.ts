/** Never return to an auth screen (or another origin) after creating a session. */
export function ownerDestination(value?: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://kenangin.invalid");
    const path = decodeURIComponent(url.pathname);
    if (/^\/(login|register|onboarding)(\/|$)/i.test(path) || path.includes("\\")) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/dashboard"; }
}
