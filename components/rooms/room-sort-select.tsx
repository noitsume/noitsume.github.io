"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RoomSortMode } from "@/lib/domain/room-sorting";

export function RoomSortSelect({ value }: { value: RoomSortMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: RoomSortMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "newest") params.delete("sort");
    else params.set("sort", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <label className="room-sort-control">
      <span>Urutkan</span>
      <select value={value} onChange={(event) => change(event.target.value as RoomSortMode)}>
        <option value="newest">Terbaru</option>
        <option value="oldest">Terlama</option>
        <option value="status">Status</option>
      </select>
    </label>
  );
}
