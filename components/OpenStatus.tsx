"use client";

import { useSyncExternalStore } from "react";
import { site } from "@/data/site";
import { localTime, openNow } from "@/lib/hours";
import { t, type Lang } from "@/lib/i18n";

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
};

// A string snapshot so React can compare it between renders.
const getState = () => {
  const s = openNow(site.hours, site.specialHours, localTime(new Date(), site.timeZone));
  return s.open ? "open" : "closed";
};

/** "Open now" / "Closed now", computed in the visitor's browser against Beirut time, holidays included. */
export function OpenStatus({ lang, className = "" }: { lang: Lang; className?: string }) {
  // null on the server: the page is static, so the real time is only known in the browser.
  const state = useSyncExternalStore(subscribe, getState, () => null);
  if (!site.hours.length && !site.specialHours.length) return null;
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
