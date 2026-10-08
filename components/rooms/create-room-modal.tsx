"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Theme } from "@/lib/data/contracts";
import { Dialog } from "@/components/ui/dialog";
import { RoomForm } from "./room-form";

export function CreateRoomModal({ themes, open, onClose }: { themes: Theme[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    onClose();
  }, [onClose, pathname, router, searchParams]);
  useEffect(() => {
    if (!open || searchParams.get("create") === "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("create", "1");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [open, pathname, router, searchParams]);
  return <Dialog open={open} title="Mulai kenangan baru" onClose={close} busy={busy}>
    <p className="dialog-intro">Untuk siapa kejutan ini? Siapkan ruangnya, lalu ajak orang-orang terdekat mengirim kenangan.</p>
    <RoomForm mode="create" themes={themes} onCancel={close} onBusyChange={setBusy} />
  </Dialog>;
}
