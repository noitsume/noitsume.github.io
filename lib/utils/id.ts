export function createId(prefix: string): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  return `${prefix}_${randomPart}`;
}
