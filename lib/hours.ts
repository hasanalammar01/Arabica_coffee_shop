import type { Hours } from "../data/site.ts";

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Day of week and minutes since midnight for `date` in the shop's time zone. */
export function localTime(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: DAY_INDEX[parts.weekday], minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Handles closing after midnight: { open: "18:00", close: "02:00" } covers 01:00 the next day. */
export function isOpenAt(hours: Hours[], day: number, minute: number): boolean {
  return hours.some(({ days, open, close }) => {
    const o = minutes(open);
    const c = minutes(close);
    if (c > o) return days.includes(day) && minute >= o && minute < c;
    const yesterday = (day + 6) % 7;
    return (days.includes(day) && minute >= o) || (days.includes(yesterday) && minute < c);
  });
}

/** [1,2,3,4,5] → "Monday – Friday", all seven → "Every day", otherwise "Mon, Wed, Fri". */
export function formatDays(days: number[]) {
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 7) return "Every day";
  if (d.length === 1) return DAY_NAMES[d[0]];
  const consecutive = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  if (consecutive) return `${DAY_NAMES[d[0]]} – ${DAY_NAMES[d[d.length - 1]]}`;
  return d.map((v) => DAY_NAMES[v].slice(0, 3)).join(", ");
}

export const formatTime = (hhmm: string) => {
  const m = minutes(hhmm);
  const h = Math.floor(m / 60) % 12 || 12;
  return `${h}${m % 60 ? `:${String(m % 60).padStart(2, "0")}` : ""} ${m < 720 ? "am" : "pm"}`;
};
