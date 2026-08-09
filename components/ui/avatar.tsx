export function Avatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span className="ui-avatar" aria-hidden="true">
      {imageUrl ? <img alt="" src={imageUrl} /> : <span>{initials || "K"}</span>}
    </span>
  );
}
