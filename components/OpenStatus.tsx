"use client";

import { useSyncExternalStore } from "react";
import type { Site } from "@/data/site";
import { localTime, openNow } from "@/lib/hours";
import { t, type Lang } from "@/lib/i18n";

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
};

/** "Open now" / "Closed now", computed in the visitor's browser against Beirut time, holidays included. */
export function OpenStatus({
  lang,
  hours,
  specialHours,
  timeZone,
  className = "",
}: Pick<Site, "hours" | "specialHours" | "timeZone"> & { lang: Lang; className?: string }) {
  // A string snapshot so React can compare it; null avoids a server/client clock mismatch.
  const getState = () =>
    openNow(hours, specialHours, localTime(new Date(), timeZone)).open ? "open" : "closed";
  const state = useSyncExternalStore(subscribe, getState, () => null);
  if (!hours.length && !specialHours.length) return null;
  const d = t(lang).visit;
  const open = state === "open";
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-2 rounded-full px-3 text-sm font-medium ${
        state === null ? "invisible" : open ? "bg-open/12 text-open" : "bg-pomegranate/12 text-pomegranate"
      } ${className}`}
      aria-live="polite"
    >
      <span aria-hidden className={`size-2 rounded-full ${open ? "bg-open" : "bg-pomegranate"}`} />
      {open ? d.openNow : d.closedNow}
    </span>
  );
}
