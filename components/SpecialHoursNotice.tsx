"use client";

import { useSyncExternalStore } from "react";
import type { Site, SpecialHours } from "@/data/site";
import { formatDate, formatTime, localTime, specialFor, upcomingSpecials } from "@/lib/hours";
import { pick, t, type Lang } from "@/lib/i18n";

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
};

/**
 * Today's holiday closure / special hours and the changes coming up in the next 30 days.
 * Worked out in the browser, so a cached page never shows yesterday's notice.
 */
export function SpecialHoursNotice({ lang, specialHours, timeZone }: Pick<Site, "specialHours" | "timeZone"> & { lang: Lang }) {
  const date = useSyncExternalStore(subscribe, () => localTime(new Date(), timeZone).date, () => null);
  if (!date || !specialHours.length) return null;
  const d = t(lang).visit;
  const now = specialFor(specialHours, date);
  const in30 = new Date(`${date}T12:00:00Z`);
  in30.setUTCDate(in30.getUTCDate() + 30);
  const limit = in30.toISOString().slice(0, 10);
  const next = upcomingSpecials(specialHours, date).filter((s) => s !== now && s.from <= limit);
  if (!now && !next.length) return null;

  const hoursOf = (s: SpecialHours) =>
    s.closed || !s.open || !s.close ? d.closed : `${formatTime(s.open, lang)} – ${formatTime(s.close, lang)}`;
  const range = (s: SpecialHours) =>
    s.to && s.to !== s.from ? `${formatDate(s.from, lang)} – ${formatDate(s.to, lang)}` : formatDate(s.from, lang);

  return (
    <div className="mt-6 space-y-3">
      {now && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 font-medium ${
            now.closed ? "bg-pomegranate/12 text-pomegranate" : "bg-surface text-ink ring-1 ring-line"
          }`}
        >
          {now.closed ? d.closedToday : `${d.specialToday}: ${hoursOf(now)}`}
          {pick(lang, now.note ?? "", now.noteAr) && <span className="font-normal"> · {pick(lang, now.note ?? "", now.noteAr)}</span>}
        </p>
      )}
      {next.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted">{d.upcoming}</h3>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {next.map((s) => (
              <li key={`${s.from}-${s.to}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                <span>
                  {range(s)}
                  {pick(lang, s.note ?? "", s.noteAr) && (
                    <span className="text-muted"> · {pick(lang, s.note ?? "", s.noteAr)}</span>
                  )}
                </span>
                <span className="tabular-nums">{hoursOf(s)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
