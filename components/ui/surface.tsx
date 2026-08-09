import type { HTMLAttributes } from "react";

export type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "elevated" | "quiet";
};

export function Surface({
  className = "",
  tone = "default",
  ...props
}: SurfaceProps) {
  return (
    <div
      className={`ui-surface ui-surface--${tone} ${className}`.trim()}
      {...props}
    />
  );
}
