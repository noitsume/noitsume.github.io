import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`ui-skeleton ${className}`.trim()} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-state__mark" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function Toast({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="ui-toast" role="status">
      <span className="ui-toast__dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}
