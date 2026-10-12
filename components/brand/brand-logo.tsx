import artwork from "@/config/brand-artwork.json";

/** Decorative lockup: give the surrounding link its destination's accessible name. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-logo ${className}`.trim()} aria-hidden="true">
      <svg className="brand-logo__mark" viewBox={artwork.mark.viewBox} width="40" height="40" fill="currentColor" focusable="false">
        {artwork.mark.paths.map(path => <path d={path} key={path} />)}
      </svg>
      <svg className="brand-logo__wordmark" viewBox={artwork.wordmark.viewBox} width="136" height="27" fill="currentColor" focusable="false">
        <path d={artwork.wordmark.name} />
        <path className="brand-logo__domain" d={artwork.wordmark.suffix} />
      </svg>
    </span>
  );
}
