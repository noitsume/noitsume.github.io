"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectPopover, type SelectOption } from "@/components/ui";
import type { RoomSortMode } from "@/lib/domain/room-sorting";

const options: SelectOption[] = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "status", label: "Status" },
];

export function RoomSortSelect({ value }: { value: RoomSortMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "newest") params.delete("sort");
    else params.set("sort", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="room-sort-control">
      <span>Urutkan</span>
      <SelectPopover
        align="right"
        ariaLabel="Urutkan room"
        compact
        options={options}
        value={value}
        onChange={change}
      />
    </div>
  );
}
