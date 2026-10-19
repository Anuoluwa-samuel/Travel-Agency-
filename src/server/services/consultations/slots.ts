import { addDays, isoWeekday, zonedDate, zonedToUtc } from "@/lib/zoned-time";

/**
 * Consultation slot generation. Pure: all inputs are passed in, so it is unit-tested directly
 * and reused by both the slot picker and the booking re-check.
 *
 * A slot is offered if at least one eligible consultant:
 *   - has working hours covering the whole slot (in their own timezone),
 *   - has no time-off overlapping it,
 *   - has no active consultation overlapping it,
 * and the slot starts after `now + minNoticeMinutes`.
 */

export interface AvailabilityWindow {
  staffId: string;
  weekday: number; // ISO 1–7
  startTime: string; // HH:MM[:SS]
  endTime: string;
  timezone: string;
}

export interface BusyPeriod {
  staffId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface SlotQuery {
  windows: readonly AvailabilityWindow[];
  /** Time off and existing active consultations. */
  busy: readonly BusyPeriod[];
  durationMinutes: number;
  /** Calendar dates to generate, interpreted in each window's timezone. */
  fromDate: string;
  days: number;
  now: Date;
  minNoticeMinutes?: number;
  stepMinutes?: number;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  staffIds: string[];
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export function generateSlots(q: SlotQuery): Slot[] {
  const step = (q.stepMinutes ?? 30) * 60_000;
  const duration = q.durationMinutes * 60_000;
  const earliest = q.now.getTime() + (q.minNoticeMinutes ?? 12 * 60) * 60_000;
  const byStart = new Map<number, Slot>();

  for (let i = 0; i < q.days; i++) {
    const date = addDays(q.fromDate, i);
    const weekday = isoWeekday(date);
    for (const w of q.windows) {
      if (w.weekday !== weekday) continue;
      const open = zonedToUtc(date, w.startTime, w.timezone).getTime();
      const close = zonedToUtc(date, w.endTime, w.timezone).getTime();
      for (let start = open; start + duration <= close; start += step) {
        const end = start + duration;
        if (start < earliest) continue;
        const blocked = q.busy.some(
          (b) => b.staffId === w.staffId && overlaps(start, end, b.startsAt.getTime(), b.endsAt.getTime()),
        );
        if (blocked) continue;
        const slot = byStart.get(start) ?? { startsAt: new Date(start), endsAt: new Date(end), staffIds: [] };
        if (!slot.staffIds.includes(w.staffId)) slot.staffIds.push(w.staffId);
        byStart.set(start, slot);
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Groups slots by calendar date in the display timezone. */
export function groupByDate(slots: readonly Slot[], timeZone: string): Map<string, Slot[]> {
  const out = new Map<string, Slot[]>();
  for (const s of slots) {
    const d = zonedDate(s.startsAt, timeZone);
    out.set(d, [...(out.get(d) ?? []), s]);
  }
  return out;
}

/**
 * Picks the consultant for a slot: fewest active consultations that day, then a stable order,
 * so work spreads evenly and results are deterministic in tests.
 */
export function pickStaff(staffIds: readonly string[], loadByStaff: ReadonlyMap<string, number>): string | null {
  if (staffIds.length === 0) return null;
  return [...staffIds].sort((a, b) => (loadByStaff.get(a) ?? 0) - (loadByStaff.get(b) ?? 0) || a.localeCompare(b))[0];
}
