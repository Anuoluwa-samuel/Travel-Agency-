import { describe, expect, it } from "vitest";
import { addDays, isoWeekday, zonedDate, zonedToUtc } from "@/lib/zoned-time";
import { generateSlots, groupByDate, pickStaff, type AvailabilityWindow } from "@/server/services/consultations/slots";

describe("zoned time", () => {
  it("converts Lagos wall time (UTC+1, no DST)", () => {
    expect(zonedToUtc("2026-10-16", "09:00", "Africa/Lagos").toISOString()).toBe("2026-10-16T08:00:00.000Z");
  });

  it("handles DST in London on both sides of the change", () => {
    expect(zonedToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    // Day after clocks go back (25 Oct 2026).
    expect(zonedToUtc("2026-10-26", "09:00", "Europe/London").toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });

  it("handles negative offsets", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("gets the calendar date and ISO weekday in a zone", () => {
    expect(zonedDate(new Date("2026-10-15T23:30:00Z"), "Africa/Lagos")).toBe("2026-10-16");
    expect(isoWeekday("2026-10-16")).toBe(5); // Friday
    expect(isoWeekday("2026-10-18")).toBe(7); // Sunday
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

const lagos = (staffId: string, weekday: number, startTime = "09:00", endTime = "12:00"): AvailabilityWindow => ({
  staffId,
  weekday,
  startTime,
  endTime,
  timezone: "Africa/Lagos",
});

describe("generateSlots", () => {
  const now = new Date("2026-10-15T08:00:00Z"); // Thu 09:00 Lagos

  it("respects working hours, duration and minimum notice", () => {
    const slots = generateSlots({
      windows: [lagos("a", 4), lagos("a", 5)],
      busy: [],
      durationMinutes: 60,
      fromDate: "2026-10-15",
      days: 2,
      now,
      minNoticeMinutes: 12 * 60,
    });
    // Thursday is entirely inside the 12h notice; Friday 09:00–12:00 gives 09:00, 09:30 … 11:00.
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      "2026-10-16T08:00:00.000Z",
      "2026-10-16T08:30:00.000Z",
      "2026-10-16T09:00:00.000Z",
      "2026-10-16T09:30:00.000Z",
      "2026-10-16T10:00:00.000Z",
    ]);
  });

  it("removes slots overlapping bookings or time off for that consultant only", () => {
    const slots = generateSlots({
      windows: [lagos("a", 5), lagos("b", 5)],
      busy: [{ staffId: "a", startsAt: new Date("2026-10-16T08:00:00Z"), endsAt: new Date("2026-10-16T09:00:00Z") }],
      durationMinutes: 30,
      fromDate: "2026-10-16",
      days: 1,
      now,
      minNoticeMinutes: 0,
    });
    const first = slots.find((s) => s.startsAt.toISOString() === "2026-10-16T08:00:00.000Z")!;
    expect(first.staffIds).toEqual(["b"]);
    const later = slots.find((s) => s.startsAt.toISOString() === "2026-10-16T09:00:00.000Z")!;
    expect(later.staffIds.sort()).toEqual(["a", "b"]);
  });

  it("treats back-to-back bookings as non-overlapping", () => {
    const slots = generateSlots({
      windows: [lagos("a", 5)],
      busy: [{ staffId: "a", startsAt: new Date("2026-10-16T08:00:00Z"), endsAt: new Date("2026-10-16T08:30:00Z") }],
      durationMinutes: 30,
      fromDate: "2026-10-16",
      days: 1,
      now,
      minNoticeMinutes: 0,
    });
    expect(slots[0].startsAt.toISOString()).toBe("2026-10-16T08:30:00.000Z");
  });

  it("uses each consultant's own timezone", () => {
    const slots = generateSlots({
      windows: [{ staffId: "uk", weekday: 5, startTime: "09:00", endTime: "10:00", timezone: "Europe/London" }],
      busy: [],
      durationMinutes: 60,
      fromDate: "2026-10-16",
      days: 1,
      now,
      minNoticeMinutes: 0,
    });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(["2026-10-16T08:00:00.000Z"]); // 09:00 BST
  });

  it("groups by date in the display timezone", () => {
    const slots = generateSlots({
      windows: [lagos("a", 5), lagos("a", 1)],
      busy: [],
      durationMinutes: 60,
      fromDate: "2026-10-16",
      days: 4,
      now,
      minNoticeMinutes: 0,
    });
    expect([...groupByDate(slots, "Africa/Lagos").keys()]).toEqual(["2026-10-16", "2026-10-19"]);
  });
});

describe("pickStaff", () => {
  it("prefers the least busy consultant, then a stable order", () => {
    expect(
      pickStaff(
        ["b", "a"],
        new Map([
          ["a", 2],
          ["b", 1],
        ]),
      ),
    ).toBe("b");
    expect(pickStaff(["b", "a"], new Map())).toBe("a");
    expect(pickStaff([], new Map())).toBeNull();
  });
});
