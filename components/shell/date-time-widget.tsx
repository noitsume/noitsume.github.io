"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon } from "@/components/ui";

function formatDateTime(date: Date) {
  const datePart = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(".", ":");

  return `${datePart} · ${timePart}`;
}

export function DateTimeWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const value = useMemo(() => (now ? formatDateTime(now) : "Memuat waktu lokal…"), [now]);

  useEffect(() => {
    const sync = () => setNow(new Date());
    sync();

    const delayToNextMinute = 60_000 - (Date.now() % 60_000) + 25;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      sync();
      interval = window.setInterval(sync, 60_000);
    }, delayToNextMinute);

    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="datetime-widget" title="Mengikuti waktu lokal perangkat">
      <span className="datetime-widget__icon"><CalendarIcon size={16} /></span>
      <span className="datetime-widget__value">{value}</span>
    </div>
  );
}
