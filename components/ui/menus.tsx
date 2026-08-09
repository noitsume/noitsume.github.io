"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MoreIcon } from "./icons";

function useDismissableDetails() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (!details.contains(event.target as Node)) details.open = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key !== "Escape" || !details?.open) return;
      details.open = false;
      details.querySelector<HTMLElement>("summary")?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return detailsRef;
}

export function DropdownMenu({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  const detailsRef = useDismissableDetails();

  return (
    <details className="ui-menu" ref={detailsRef}>
      <summary className="ui-menu__summary">{label}</summary>
      <div className="ui-menu__popover">{children}</div>
    </details>
  );
}

export function ContextMenu({
  ariaLabel = "Buka opsi lainnya",
  children,
}: {
  ariaLabel?: string;
  children: ReactNode;
}) {
  const detailsRef = useDismissableDetails();

  return (
    <details className="ui-menu ui-menu--context" ref={detailsRef}>
      <summary aria-label={ariaLabel} className="ui-menu__icon-summary">
        <span className="sr-only">{ariaLabel}</span>
        <span className="ui-menu__icon-visual" aria-hidden="true">
          <MoreIcon size={17} />
        </span>
      </summary>
      <div className="ui-menu__popover">{children}</div>
    </details>
  );
}

export function MenuItem({
  children,
  destructive = false,
  onClick,
}: {
  children: ReactNode;
  destructive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`ui-menu__item ${destructive ? "ui-menu__item--destructive" : ""}`.trim()}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby="kenangin-modal-title"
      aria-describedby={description ? "kenangin-modal-description" : undefined}
      className="ui-modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      ref={dialogRef}
    >
      <div className="ui-modal__header">
        <div>
          <h2 id="kenangin-modal-title">{title}</h2>
          {description ? <p id="kenangin-modal-description">{description}</p> : null}
        </div>
        <button aria-label="Tutup dialog" className="ui-modal__close" onClick={onClose} type="button">×</button>
      </div>
      <div className="ui-modal__body">{children}</div>
    </dialog>
  );
}
