import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  icon,
  action,
  headingId,
}: {
  eyebrow?: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  headingId?: string;
}) {
  return (
    <div className="ui-section-header">
      <div>
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <div className="ui-section-header__title-row">
          {icon ? <span className="ui-section-header__icon">{icon}</span> : null}
          <h2 id={headingId}>{title}</h2>
        </div>
      </div>
      {action ? <div className="ui-section-header__action">{action}</div> : null}
    </div>
  );
}
