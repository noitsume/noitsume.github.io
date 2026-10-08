import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeading({ title, description, eyebrow, backHref = "/dashboard", backLabel = "Kenangan saya", action }: {
  title: string; description?: string; eyebrow?: string; backHref?: string; backLabel?: string; action?: ReactNode;
}) {
  return <header className="journey-heading">
    <Link className="journey-back" href={backHref}><span aria-hidden="true">←</span> {backLabel}</Link>
    <div className="journey-heading__row"><div>{eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{action}</div>
  </header>;
}
