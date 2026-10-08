"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/** Browser top layer supplies inert background, focus containment and restoration. */
export function Dialog({ open, onClose, title, children, className = "", busy = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, [open]);
  return <dialog ref={ref} className={`journey-dialog ${className}`} aria-label={title}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <div className="journey-dialog__heading"><h2>{title}</h2><button className="ui-icon-button" aria-label="Tutup" disabled={busy} onClick={onClose} type="button"><CloseIcon size={19} /></button></div>
    {open ? children : null}
  </dialog>;
}
