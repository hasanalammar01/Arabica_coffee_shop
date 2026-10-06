"use client";

import { useSyncExternalStore } from "react";
import { site } from "@/data/site";
import { isOpenAt, localTime } from "@/lib/hours";

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
};

const getOpen = () => {
  const { day, minute } = localTime(new Date(), site.timeZone);
  return isOpenAt(site.hours ?? [], day, minute);
};

/** "Open now" / "Closed now", computed in the visitor's browser against Beirut time. */
export function OpenStatus({ className = "" }: { className?: string }) {
  // null on the server: the page is static, so the real time is only known in the browser.
  const open = useSyncExternalStore(subscribe, getOpen, () => null);
  if (!site.hours?.length) return null;
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-2 rounded-full px-3 text-sm font-medium ${
        open === null ? "invisible" : open ? "bg-open/12 text-open" : "bg-pomegranate/12 text-pomegranate"
      } ${className}`}
      aria-live="polite"
    >
      <span aria-hidden className={`size-2 rounded-full ${open ? "bg-open" : "bg-pomegranate"}`} />
      {open ? "Open now" : "Closed now"}
    </span>
  );
}
