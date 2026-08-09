export function Avatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span className="ui-avatar" aria-hidden="true">
      {imageUrl ? (
        // The avatar URL can come from arbitrary identity providers. Keeping a native
        // img avoids requiring every provider host in next/image remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={imageUrl} />
      ) : (
        <span>{initials || "K"}</span>
      )}
    </span>
  );
}
