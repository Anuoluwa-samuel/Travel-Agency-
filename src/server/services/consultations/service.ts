import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { brand } from "@/config/brand";
import { generateReference } from "@/lib/reference";
import type { ConsultationBookingInput } from "@/lib/validation/consultation";
import { FORMAT_LABELS } from "@/lib/validation/consultation";
import { addDays, formatInZone, zonedDate } from "@/lib/zoned-time";
import { db } from "@/server/db/client";
import {
  availabilityExceptions,
  consultationServiceStaff,
  consultationServices,
  consultations,
  staffAvailability,
  staffProfiles,
} from "@/server/db/schema";
import { getEmailProvider } from "@/server/integrations/email";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { type BusyPeriod, generateSlots, pickStaff, type Slot } from "./slots";

export const BUSINESS_TZ = brand.businessTimezone;
export const BOOKING_WINDOW_DAYS = 21;
export const MIN_NOTICE_MINUTES = 12 * 60;
const ACTIVE = ["requested", "confirmed", "rescheduled"] as const;

export const CONSULTATIONS_TAG = "consultation-services";

export async function listConsultationServices() {
  "use cache";
  cacheLife("hours");
  cacheTag(CONSULTATIONS_TAG);
  return db
    .select({
      slug: consultationServices.slug,
      name: consultationServices.name,
      description: consultationServices.description,
      durationMinutes: consultationServices.durationMinutes,
      formats: consultationServices.formats,
      priceMinor: consultationServices.priceMinor,
      currency: consultationServices.currency,
    })
    .from(consultationServices)
    .where(eq(consultationServices.isActive, true))
    .orderBy(asc(consultationServices.position));
}

async function getActiveService(slug: string) {
  const [s] = await db
    .select()
    .from(consultationServices)
    .where(and(eq(consultationServices.slug, slug), eq(consultationServices.isActive, true)));
  return s ?? null;
}

/**
 * Live availability. Not cached: it changes with every booking. The window starts today in the
 * business timezone; the minimum-notice rule removes slots that are too soon.
 */
export async function getAvailability(serviceSlug: string, now = new Date(), days = BOOKING_WINDOW_DAYS) {
  const service = await getActiveService(serviceSlug);
  if (!service) return null;
  const slots = await computeSlots(service.id, service.durationMinutes, now, days);
  return { service, slots };
}

async function computeSlots(serviceId: string, durationMinutes: number, now: Date, days: number): Promise<Slot[]> {
  const staff = await db
    .select({ staffId: consultationServiceStaff.staffId })
    .from(consultationServiceStaff)
    .innerJoin(staffProfiles, eq(staffProfiles.userId, consultationServiceStaff.staffId))
    .where(and(eq(consultationServiceStaff.serviceId, serviceId), eq(staffProfiles.isActive, true)));
  const staffIds = staff.map((s) => s.staffId);
  if (staffIds.length === 0) return [];

  const fromDate = zonedDate(now, BUSINESS_TZ);
  // Generous bounds: busy periods are filtered precisely inside generateSlots.
  const rangeStart = new Date(now.getTime() - 86_400_000);
  const rangeEnd = new Date(now.getTime() + (days + 2) * 86_400_000);

  const [windows, timeOff, booked] = await Promise.all([
    db.select().from(staffAvailability).where(inArray(staffAvailability.staffId, staffIds)),
    db
      .select({
        staffId: availabilityExceptions.staffId,
        startsAt: availabilityExceptions.startsAt,
        endsAt: availabilityExceptions.endsAt,
      })
      .from(availabilityExceptions)
      .where(
        and(
          inArray(availabilityExceptions.staffId, staffIds),
          lt(availabilityExceptions.startsAt, rangeEnd),
          gte(availabilityExceptions.endsAt, rangeStart),
        ),
      ),
    db
      .select({ staffId: consultations.staffId, startsAt: consultations.startsAt, endsAt: consultations.endsAt })
      .from(consultations)
      .where(
        and(
          inArray(consultations.staffId, staffIds),
          inArray(consultations.status, [...ACTIVE]),
          lt(consultations.startsAt, rangeEnd),
          gte(consultations.endsAt, rangeStart),
        ),
      ),
  ]);

  const busy: BusyPeriod[] = [...timeOff, ...booked];
  return generateSlots({
    windows: windows.map((w) => ({
      staffId: w.staffId,
      weekday: w.weekday,
      startTime: w.startTime,
      endTime: w.endTime,
      timezone: w.timezone,
    })),
    busy,
    durationMinutes,
    fromDate,
    days,
    now,
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  });
}

export interface BookConsultationContext {
  customerUserId: string | null;
  idempotencyKey?: string;
  now?: Date;
}

function isConstraint(e: unknown, code: string, name?: string) {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const c = err.code ?? err.cause?.code;
  const n = err.constraint_name ?? err.cause?.constraint_name;
  return c === code && (!name || n === name);
}

/**
 * Books a slot. The slot is re-validated against live availability, a consultant is chosen,
 * and the insert relies on the database exclusion constraint for the final word: if a
 * concurrent booking took that consultant, the next eligible consultant is tried.
 */
export async function bookConsultation(input: ConsultationBookingInput, ctx: BookConsultationContext) {
  const now = ctx.now ?? new Date();
  const service = await getActiveService(input.serviceSlug);
  if (!service) throw new AppError("NOT_FOUND", "That consultation type isn't available.");
  if (!service.formats.includes(input.format)) {
    throw new AppError("VALIDATION", "That meeting format isn't offered for this consultation.");
  }

  const startsAt = new Date(input.startsAt);
  const idempotencyKey = ctx.idempotencyKey
    ? `client:${ctx.idempotencyKey}`
    : `hash:${createHash("sha256").update([input.email, service.id, startsAt.toISOString()].join("|")).digest("hex")}`;

  const [existing] = await db
    .select({ reference: consultations.reference, startsAt: consultations.startsAt, endsAt: consultations.endsAt })
    .from(consultations)
    .where(eq(consultations.idempotencyKey, idempotencyKey));
  if (existing) return { ...existing, duplicate: true, confirmationSent: false, serviceName: service.name };

  const slots = await computeSlots(service.id, service.durationMinutes, now, BOOKING_WINDOW_DAYS);
  const slot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!slot) throw new AppError("CONFLICT", "That time is no longer available. Please pick another slot.");

  // Spread work: fewer bookings that day wins.
  const day = zonedDate(slot.startsAt, BUSINESS_TZ);
  const dayStart = new Date(`${day}T00:00:00Z`);
  const loadRows = await db
    .select({ staffId: consultations.staffId, n: sql<number>`count(*)::int` })
    .from(consultations)
    .where(
      and(
        inArray(consultations.staffId, slot.staffIds),
        inArray(consultations.status, [...ACTIVE]),
        gte(consultations.startsAt, new Date(dayStart.getTime() - 86_400_000)),
        lt(consultations.startsAt, new Date(`${addDays(day, 1)}T23:59:59Z`)),
      ),
    )
    .groupBy(consultations.staffId);
  const load = new Map(loadRows.map((r) => [r.staffId, r.n]));

  const candidates = [...slot.staffIds];
  while (candidates.length > 0) {
    const staffId = pickStaff(candidates, load)!;
    candidates.splice(candidates.indexOf(staffId), 1);
    for (let attempt = 0; attempt < 3; attempt++) {
      const reference = generateReference("consultation");
      try {
        const [row] = await db
          .insert(consultations)
          .values({
            reference,
            serviceId: service.id,
            customerUserId: ctx.customerUserId,
            contactName: input.name,
            contactEmail: input.email,
            contactPhone: input.phone ?? null,
            staffId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            customerTimezone: input.timezone,
            format: input.format,
            status: "confirmed",
            notes: input.notes ?? null,
            idempotencyKey,
          })
          .returning({
            id: consultations.id,
            reference: consultations.reference,
            startsAt: consultations.startsAt,
            endsAt: consultations.endsAt,
          });

        const confirmationSent = await sendConfirmation(row.id, {
          to: input.email,
          name: input.name,
          reference: row.reference,
          serviceName: service.name,
          format: input.format,
          startsAt: row.startsAt,
          timezone: input.timezone,
        });
        logger.info({ consultationId: row.id }, "Consultation booked");
        return {
          reference: row.reference,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          duplicate: false,
          confirmationSent,
          serviceName: service.name,
        };
      } catch (e) {
        if (isConstraint(e, "23505", "consultations_reference_uq")) continue;
        if (isConstraint(e, "23505", "consultations_idempotency_uq")) {
          const [dupe] = await db
            .select({
              reference: consultations.reference,
              startsAt: consultations.startsAt,
              endsAt: consultations.endsAt,
            })
            .from(consultations)
            .where(eq(consultations.idempotencyKey, idempotencyKey));
          return { ...dupe, duplicate: true, confirmationSent: false, serviceName: service.name };
        }
        // Exclusion constraint: this consultant was taken a moment ago. Try the next one.
        if (isConstraint(e, "23P01")) break;
        throw e;
      }
    }
  }
  throw new AppError("CONFLICT", "That time was just booked by someone else. Please pick another slot.");
}

async function sendConfirmation(
  consultationId: string,
  m: {
    to: string;
    name: string;
    reference: string;
    serviceName: string;
    format: keyof typeof FORMAT_LABELS;
    startsAt: Date;
    timezone: string;
  },
) {
  const when = (tz: string) =>
    formatInZone(m.startsAt, tz, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  const local = when(m.timezone);
  const business = m.timezone === BUSINESS_TZ ? null : when(BUSINESS_TZ);
  const text = `Hi ${m.name.split(" ")[0]},

Your ${m.serviceName.toLowerCase()} with ${brand.name} is booked.

When: ${local}${business ? ` (${business} Lagos time)` : ""}
How: ${FORMAT_LABELS[m.format]}
Reference: ${m.reference}

${m.format === "video" ? "Your consultant will email the video link before the call." : m.format === "phone" ? "Your consultant will call the number you gave us." : "We'll confirm the meeting address with you before the day."}

Need to change it? Reply to this email or contact us with your reference.

— The ${brand.name} team`;
  try {
    const res = await getEmailProvider().send({
      to: m.to,
      subject: `Your consultation is booked (${m.reference})`,
      text,
      idempotencyKey: `consultation-confirm:${consultationId}`,
    });
    if (res.delivered) {
      await db
        .update(consultations)
        .set({ confirmationSentAt: new Date() })
        .where(eq(consultations.id, consultationId));
      return true;
    }
  } catch (err) {
    logger.error({ err, consultationId }, "Consultation confirmation email failed");
  }
  return false;
}
