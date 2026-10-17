import type { Hours, SpecialHours } from "../data/site.ts";

type Lang = "en" | "ar";

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Day of week, minutes since midnight and "YYYY-MM-DD" for `date` in the shop's time zone. */
export function localTime(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: DAY_INDEX[parts.weekday],
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** The date before "YYYY-MM-DD". */
export const previousDate = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

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

/** The special-hours entry covering a date, if any (later entries win over earlier ones). */
export const specialFor = (specials: SpecialHours[], date: string) =>
  [...specials].reverse().find((s) => s.from <= date && date <= (s.to || s.from));

/**
 * Open right now? Special hours / closures for today replace the weekly hours for today;
 * the weekly hours still apply after midnight unless yesterday was special too.
 */
export function openNow(weekly: Hours[], specials: SpecialHours[], now: { day: number; minute: number; date: string }) {
  const today = specialFor(specials, now.date);
  const yesterday = specialFor(specials, previousDate(now.date));
  const prevDay = (now.day + 6) % 7;

  // Spill-over from yesterday (after-midnight closing).
  let spill = false;
  if (yesterday) {
    if (!yesterday.closed && yesterday.open && yesterday.close)
      spill = minutes(yesterday.close) < minutes(yesterday.open) && now.minute < minutes(yesterday.close);
  } else {
    spill = weekly.some(
      ({ days, open, close }) =>
        days.includes(prevDay) && minutes(close) < minutes(open) && now.minute < minutes(close),
    );
  }
  if (spill) return { open: true, special: today };

  if (today) {
    if (today.closed || !today.open || !today.close) return { open: false, special: today };
    const o = minutes(today.open);
    const c = minutes(today.close);
    return { open: c > o ? now.minute >= o && now.minute < c : now.minute >= o, special: today };
  }
  return {
    open: weekly.some(({ days, open, close }) => {
      const o = minutes(open);
      const c = minutes(close);
      return days.includes(now.day) && (c > o ? now.minute >= o && now.minute < c : now.minute >= o);
    }),
    special: undefined,
  };
}

/** Special hours from `date` onwards (for listing upcoming closures on the site). */
export const upcomingSpecials = (specials: SpecialHours[], date: string) =>
  specials.filter((s) => (s.to || s.from) >= date).sort((a, b) => a.from.localeCompare(b.from));

/** [1,2,3,4,5] → "Monday – Friday", all seven → "Every day", otherwise "Mon, Wed, Fri". */
export function formatDays(days: number[], lang: Lang = "en") {
  const names = lang === "ar" ? DAY_NAMES_AR : DAY_NAMES;
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 7) return lang === "ar" ? "كل يوم" : "Every day";
  if (d.length === 1) return names[d[0]];
  const consecutive = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  if (consecutive) return `${names[d[0]]} – ${names[d[d.length - 1]]}`;
  return d.map((v) => (lang === "ar" ? names[v] : names[v].slice(0, 3))).join(lang === "ar" ? "، " : ", ");
}

export const formatTime = (hhmm: string, lang: Lang = "en") => {
  const m = minutes(hhmm);
  const h = Math.floor(m / 60) % 12 || 12;
  const mm = m % 60 ? `:${String(m % 60).padStart(2, "0")}` : "";
  if (lang === "ar") return `${h}${mm} ${m < 720 ? "ص" : "م"}`;
  return `${h}${mm} ${m < 720 ? "am" : "pm"}`;
};

/** "2026-12-25" → "Fri 25 Dec" / Arabic equivalent. */
export const formatDate = (date: string, lang: Lang = "en") =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-LB" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
