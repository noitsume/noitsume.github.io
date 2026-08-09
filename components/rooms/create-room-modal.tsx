"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Theme } from "@/lib/data/contracts";
import { CloseIcon } from "@/components/ui";
import { RoomForm } from "./room-form";

export function CreateRoomModal({
  themes,
  open,
  onClose,
}: {
  themes: Theme[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    onClose();
  }, [onClose, pathname, router, searchParams]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose, open]);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("create") !== "1") {
      params.set("create", "1");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [open, pathname, router, searchParams]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="room-modal" role="dialog" aria-modal="true" aria-labelledby="create-room-modal-title">
      <button className="room-modal__scrim" type="button" aria-label="Tutup popup buat room" onClick={handleClose} />
      <div className="room-modal__dialog">
        <div className="room-modal__hero">
          <div>
            <p className="ui-eyebrow">NEW WORKSPACE</p>
            <div className="room-modal__title-row">
              <h2 id="create-room-modal-title">Buat Room Baru</h2>
            </div>
            <p>Mulai kejutan berikutnya dalam beberapa langkah mudah. Tetap ringkas tanpa meninggalkan Dashboard.</p>
          </div>
          <button className="room-modal__close" type="button" aria-label="Tutup popup" onClick={handleClose}>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="room-modal__body">
          <RoomForm mode="create" themes={themes} onCancel={handleClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
