import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDays, formatTime, isOpenAt, localTime, openNow, specialFor, upcomingSpecials } from "./hours.ts";

const h = (hh: number, mm = 0) => hh * 60 + mm;

test("same-day hours", () => {
  const hours = [{ days: [1, 2, 3, 4, 5], open: "08:00", close: "22:00" }];
  assert.equal(isOpenAt(hours, 1, h(8)), true);
  assert.equal(isOpenAt(hours, 1, h(7, 59)), false);
  assert.equal(isOpenAt(hours, 1, h(22)), false);
  assert.equal(isOpenAt(hours, 0, h(12)), false);
});

test("closing after midnight belongs to the previous day", () => {
  const hours = [{ days: [5], open: "18:00", close: "02:00" }];
  assert.equal(isOpenAt(hours, 5, h(23)), true);
  assert.equal(isOpenAt(hours, 6, h(1, 30)), true);
  assert.equal(isOpenAt(hours, 6, h(2)), false);
  assert.equal(isOpenAt(hours, 5, h(1)), false);
});

test("close at 00:00 means midnight", () => {
  const hours = [{ days: [0, 1, 2, 3, 4, 5, 6], open: "08:00", close: "00:00" }];
  assert.equal(isOpenAt(hours, 3, h(23, 59)), true);
  assert.equal(isOpenAt(hours, 3, h(0, 30)), false);
});

test("Beirut local time", () => {
  // 2026-10-06 21:30 UTC is Wednesday 00:30 in Beirut (UTC+3)
  assert.deepEqual(localTime(new Date("2026-10-06T21:30:00Z"), "Asia/Beirut"), {
    day: 3,
    minute: 30,
    date: "2026-10-07",
  });
});

test("formatDays", () => {
  assert.equal(formatDays([0, 1, 2, 3, 4, 5, 6]), "Every day");
  assert.equal(formatDays([5, 1, 2, 3, 4]), "Monday – Friday");
  assert.equal(formatDays([1, 3, 5]), "Mon, Wed, Fri");
});

test("formatTime", () => {
  assert.equal(formatTime("00:00"), "12 am");
  assert.equal(formatTime("08:30"), "8:30 am");
  assert.equal(formatTime("13:00"), "1 pm");
});

const weekly = [{ days: [0, 1, 2, 3, 4, 5, 6], open: "08:00", close: "23:00" }];

test("holiday closure overrides the weekly hours for that day", () => {
  const specials = [{ from: "2026-12-25", closed: true, note: "Christmas" }];
  assert.equal(openNow(weekly, specials, { day: 5, minute: h(12), date: "2026-12-25" }).open, false);
  assert.equal(openNow(weekly, specials, { day: 5, minute: h(12), date: "2026-12-25" }).special?.note, "Christmas");
  assert.equal(openNow(weekly, specials, { day: 6, minute: h(12), date: "2026-12-26" }).open, true);
});

test("special hours and date ranges", () => {
  const specials = [{ from: "2026-12-31", to: "2027-01-01", closed: false, open: "18:00", close: "03:00" }];
  assert.equal(openNow(weekly, specials, { day: 4, minute: h(12), date: "2026-12-31" }).open, false);
  assert.equal(openNow(weekly, specials, { day: 4, minute: h(23, 30), date: "2026-12-31" }).open, true);
  // after midnight, still yesterday's special evening
  assert.equal(openNow(weekly, specials, { day: 5, minute: h(2), date: "2027-01-01" }).open, true);
  assert.equal(specialFor(specials, "2027-01-02"), undefined);
});

test("weekly after-midnight closing still spills over", () => {
  const late = [{ days: [5], open: "18:00", close: "02:00" }];
  assert.equal(openNow(late, [], { day: 6, minute: h(1), date: "2026-10-10" }).open, true);
  assert.equal(openNow(late, [{ from: "2026-10-09", closed: true }], { day: 6, minute: h(1), date: "2026-10-10" }).open, false);
});

test("upcoming specials skip the past", () => {
  const specials = [
    { from: "2026-01-01", closed: true },
    { from: "2026-12-24", to: "2026-12-26", closed: true },
  ];
  assert.deepEqual(upcomingSpecials(specials, "2026-12-25").map((s) => s.from), ["2026-12-24"]);
});

test("Arabic formatting", () => {
  assert.equal(formatDays([0, 1, 2, 3, 4, 5, 6], "ar"), "كل يوم");
  assert.equal(formatTime("08:30", "ar"), "8:30 ص");
  assert.equal(formatTime("13:00", "ar"), "1 م");
});
