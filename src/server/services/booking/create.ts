import "server-only";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { generateReference } from "@/lib/reference";
import type { BookingRequest, Selection } from "@/lib/validation/booking";
import { db, type Tx } from "@/server/db/client";
import {
  bookingItems,
  bookingStatusHistory,
  bookingTravellers,
  bookings,
  inventoryHolds,
  packageDepartures,
  packages,
  quoteLines,
  quotes,
} from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { encryptField } from "@/server/lib/crypto";
import { logger } from "@/server/lib/logger";
import { computeQuote, QuoteError, type QuoteResult } from "@/server/services/pricing/quote";
import { loadQuoteContext, todayIso } from "./context";
import { issueInvoice } from "./invoice";
import { applyTransition } from "./state";

export const QUOTE_VALIDITY_MS = 24 * 60 * 60_000;
/** Instant bookings hold seats while the customer pays. */
export const INSTANT_HOLD_MS = 30 * 60_000;
/** Request-to-book holds seats while staff confirm with suppliers. */
export const REQUEST_HOLD_MS = 72 * 60 * 60_000;

function quoteError(e: unknown): never {
  if (e instanceof QuoteError) {
    throw new AppError(
      e.code === "NOT_ENOUGH_SEATS" || e.code === "DEPARTURE_UNAVAILABLE" ? "CONFLICT" : "VALIDATION",
      e.message,
      {
        quoteError: e.code,
      },
    );
  }
  throw e;
}

async function packageIdForSlug(slug: string) {
  const [p] = await db.select({ id: packages.id }).from(packages).where(eq(packages.slug, slug));
  return p?.id ?? null;
}

/**
 * Prices a selection on the server and stores it as a quote valid for 24 hours. The customer
 * sees exactly these lines; nothing the browser sends can change the amounts.
 */
export async function createQuote(
  packageSlug: string,
  selection: Selection,
  ctx: { customerUserId: string | null; now?: Date },
) {
  const now = ctx.now ?? new Date();
  const packageId = await packageIdForSlug(packageSlug);
  if (!packageId) throw new AppError("NOT_FOUND", "That package isn't available.");
  const loaded = await loadQuoteContext(db, packageId, selection.departureId, { today: todayIso(now) });
  if (!loaded) throw new AppError("NOT_FOUND", "That departure isn't available.");
  if (loaded.pkg.bookingMode === "enquiry") {
    throw new AppError("VALIDATION", "This package is quoted by a consultant. Please send an enquiry.");
  }

  let result: QuoteResult;
  try {
    result = computeQuote(loaded.ctx, selection);
  } catch (e) {
    quoteError(e);
  }

  const reference = generateReference("quote");
  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(quotes)
      .values({
        reference,
        customerUserId: ctx.customerUserId,
        productType: "package",
        packageId,
        departureId: selection.departureId,
        input: selection,
        currency: result.currency,
        subtotalMinor: result.subtotalMinor,
        feesMinor: result.feesMinor,
        taxMinor: result.taxMinor,
        totalMinor: result.totalMinor,
        depositMinor: result.depositMinor,
        balanceDueDate: result.balanceDueDate,
        expiresAt: new Date(now.getTime() + QUOTE_VALIDITY_MS),
        cancellationPolicyId: loaded.pkg.cancellationPolicyId,
        termsPolicyId: loaded.pkg.termsPolicyId,
      })
      .returning();
    await tx.insert(quoteLines).values(
      result.lines.map((l, i) => ({
        quoteId: inserted[0].id,
        kind: l.kind,
        description: l.description,
        optionId: l.optionId,
        travellerType: l.travellerType,
        quantity: l.quantity,
        unitMinor: l.unitMinor,
        totalMinor: l.totalMinor,
        source: "price_rule" as const,
        position: i,
      })),
    );
    return inserted;
  });

  return { quote: row, result, bookingMode: loaded.pkg.bookingMode };
}

export interface CreateBookingContext {
  customerUserId: string | null;
  idempotencyKey?: string;
  now?: Date;
}

export type CreateBookingResult =
  | { kind: "created"; reference: string; bookingId: string; status: string; duplicate: boolean }
  | { kind: "price_changed"; newQuoteReference: string; oldTotalMinor: bigint; newTotalMinor: bigint };

function isUniqueViolation(e: unknown, constraint: string) {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  return (
    (err.code ?? err.cause?.code) === "23505" && (err.constraint_name ?? err.cause?.constraint_name) === constraint
  );
}

function isCheckViolation(e: unknown, constraint: string) {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  return (
    (err.code ?? err.cause?.code) === "23514" && (err.constraint_name ?? err.cause?.constraint_name) === constraint
  );
}

/**
 * Turns an accepted quote into a booking (journeys J02).
 *
 * In one transaction: lock the departure, re-price from current rules, stop with
 * `price_changed` if anything moved (the customer must accept the new quote), then create the
 * booking, travellers (encrypted), items and seat hold, accept the quote, and move the booking
 * out of draft. Instant packages also get an invoice and payment schedule.
 */
export async function createBookingFromQuote(
  req: BookingRequest,
  ctx: CreateBookingContext,
): Promise<CreateBookingResult> {
  const now = ctx.now ?? new Date();
  const idempotencyKey = ctx.idempotencyKey
    ? `client:${ctx.idempotencyKey}`
    : `quote:${createHash("sha256").update(req.quoteReference).digest("hex")}`;

  const existing = await db
    .select({ id: bookings.id, reference: bookings.reference, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.idempotencyKey, idempotencyKey));
  if (existing[0])
    return {
      kind: "created",
      bookingId: existing[0].id,
      reference: existing[0].reference,
      status: existing[0].status,
      duplicate: true,
    };

  const [quote] = await db.select().from(quotes).where(eq(quotes.reference, req.quoteReference));
  if (!quote || !quote.packageId || !quote.departureId)
    throw new AppError("NOT_FOUND", "That quote could not be found.");
  if (quote.status === "accepted") {
    const [b] = await db
      .select({ id: bookings.id, reference: bookings.reference, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.quoteId, quote.id));
    if (b) return { kind: "created", bookingId: b.id, reference: b.reference, status: b.status, duplicate: true };
  }
  if (quote.status !== "active" || quote.expiresAt < now) {
    throw new AppError("CONFLICT", "This quote has expired. Please check the latest price and try again.", {
      reason: "quote_expired",
    });
  }
  if (quote.customerUserId && quote.customerUserId !== ctx.customerUserId) {
    throw new AppError("NOT_FOUND", "That quote could not be found.");
  }

  const selection = quote.input as Selection;
  const paxRequested = selection.rooms.reduce((s, r) => s + r.adults + r.children, 0);
  const adultsRequested = selection.rooms.reduce((s, r) => s + r.adults, 0);
  const travellerAdults = req.travellers.filter((t) => t.type === "adult").length;
  if (req.travellers.length !== paxRequested || travellerAdults !== adultsRequested) {
    throw new AppError("VALIDATION", `Please enter details for all ${paxRequested} traveller(s) in this booking.`);
  }

  try {
    return await db.transaction(async (tx) => {
      const loaded = await loadQuoteContext(tx, quote.packageId!, quote.departureId!, {
        lock: true,
        today: todayIso(now),
      });
      if (!loaded) throw new AppError("CONFLICT", "That departure is no longer available.");

      let fresh: QuoteResult;
      try {
        fresh = computeQuote(loaded.ctx, selection);
      } catch (e) {
        quoteError(e);
      }

      if (
        fresh.totalMinor !== quote.totalMinor ||
        fresh.depositMinor !== quote.depositMinor ||
        fresh.currency !== quote.currency.trim()
      ) {
        // Supersede and issue a new quote; the customer must accept the new price explicitly.
        await tx.update(quotes).set({ status: "superseded" }).where(eq(quotes.id, quote.id));
        const newRef = generateReference("quote");
        const [nq] = await tx
          .insert(quotes)
          .values({
            reference: newRef,
            customerUserId: quote.customerUserId,
            productType: "package",
            packageId: quote.packageId,
            departureId: quote.departureId,
            input: selection,
            currency: fresh.currency,
            subtotalMinor: fresh.subtotalMinor,
            feesMinor: fresh.feesMinor,
            taxMinor: fresh.taxMinor,
            totalMinor: fresh.totalMinor,
            depositMinor: fresh.depositMinor,
            balanceDueDate: fresh.balanceDueDate,
            expiresAt: new Date(now.getTime() + QUOTE_VALIDITY_MS),
            cancellationPolicyId: loaded.pkg.cancellationPolicyId,
            termsPolicyId: loaded.pkg.termsPolicyId,
          })
          .returning({ id: quotes.id });
        await tx.insert(quoteLines).values(
          fresh.lines.map((l, i) => ({
            quoteId: nq.id,
            kind: l.kind,
            description: l.description,
            optionId: l.optionId,
            travellerType: l.travellerType,
            quantity: l.quantity,
            unitMinor: l.unitMinor,
            totalMinor: l.totalMinor,
            source: "price_rule" as const,
            position: i,
          })),
        );
        return {
          kind: "price_changed" as const,
          newQuoteReference: newRef,
          oldTotalMinor: quote.totalMinor,
          newTotalMinor: fresh.totalMinor,
        };
      }

      const instant = loaded.pkg.bookingMode === "instant";
      const holdUntil = new Date(now.getTime() + (instant ? INSTANT_HOLD_MS : REQUEST_HOLD_MS));
      const dep = loaded.ctx.departure;
      const endDate = (dep as { endDate: string }).endDate;

      let reference = "";
      let bookingId = "";
      for (let attempt = 0; attempt < 3 && !bookingId; attempt++) {
        reference = generateReference("booking");
        try {
          // Savepoint: a failed insert would otherwise abort the whole transaction, so a
          // reference collision couldn't be retried.
          const [b] = await tx.transaction((sp) =>
            sp
              .insert(bookings)
              .values({
                reference,
                type: "package",
                status: "draft",
                customerUserId: ctx.customerUserId,
                contactName: req.contact.name,
                contactEmail: req.contact.email,
                contactPhone: req.contact.phone,
                quoteId: quote.id,
                packageId: quote.packageId,
                departureId: quote.departureId,
                currency: fresh.currency,
                totalMinor: fresh.totalMinor,
                depositMinor: fresh.depositMinor,
                adults: fresh.adults,
                children: fresh.children,
                travelStart: dep.startDate,
                travelEnd: endDate,
                balanceDueDate: fresh.balanceDueDate,
                idempotencyKey,
                cancellationPolicyId: quote.cancellationPolicyId,
                termsPolicyId: quote.termsPolicyId,
                expiresAt: holdUntil,
                customerNotes: req.notes ?? null,
              })
              .returning({ id: bookings.id }),
          );
          bookingId = b.id;
        } catch (e) {
          if (isUniqueViolation(e, "bookings_reference_uq")) continue;
          throw e;
        }
      }
      if (!bookingId) throw new AppError("CONFLICT", "We couldn't create your booking. Please try again.");

      await tx
        .insert(bookingStatusHistory)
        .values({ bookingId, fromStatus: null, toStatus: "draft", actorType: "customer", actorId: ctx.customerUserId });

      await tx.insert(bookingTravellers).values(
        req.travellers.map((t, i) => ({
          bookingId,
          travellerType: t.type,
          title: t.title ?? null,
          firstName: t.firstName,
          lastName: t.lastName,
          // AAD binds each ciphertext to its booking, so values can't be swapped between rows.
          dateOfBirthEnc: t.dateOfBirth ? encryptField(t.dateOfBirth, bookingId) : null,
          passportNumberEnc: t.passportNumber ? encryptField(t.passportNumber, bookingId) : null,
          passportLast4: t.passportNumber ? t.passportNumber.slice(-4) : null,
          passportExpiry: t.passportExpiry ?? null,
          nationality: t.nationality ?? null,
          isLead: i === 0 ? 1 : 0,
          position: i,
        })),
      );

      await tx.insert(bookingItems).values(
        fresh.lines.map((l) => ({
          bookingId,
          kind: (l.kind === "tax" ? "fee" : l.kind) as "room" | "addon" | "fee",
          description: l.description,
          optionId: l.optionId,
          quantity: l.quantity,
          unitMinor: l.unitMinor,
          totalMinor: l.totalMinor,
          confirmationStatus: instant ? ("held" as const) : ("requested" as const),
        })),
      );

      // The CHECK on package_departures makes overselling impossible even if two transactions race.
      const pax = fresh.adults + fresh.children;
      await tx
        .update(packageDepartures)
        .set({ seatsHeld: sql`${packageDepartures.seatsHeld} + ${pax}` })
        .where(eq(packageDepartures.id, dep.id));
      await tx.insert(inventoryHolds).values({ departureId: dep.id, bookingId, seats: pax, expiresAt: holdUntil });

      await tx
        .update(quotes)
        .set({ status: "accepted", acceptedAt: now })
        .where(and(eq(quotes.id, quote.id), eq(quotes.status, "active")));

      const booking = { id: bookingId, type: "package" as const, status: "draft" as const };
      if (instant) {
        await applyTransition(
          tx,
          booking,
          "awaiting_payment",
          { type: "system" },
          "Seats held while payment is completed",
        );
        await issueInvoice(tx, {
          bookingId,
          currency: fresh.currency,
          totalMinor: fresh.totalMinor,
          depositMinor: fresh.depositMinor,
          balanceDueDate: fresh.balanceDueDate,
          now,
        });
      } else {
        await applyTransition(
          tx,
          booking,
          "request_submitted",
          { type: "customer", id: ctx.customerUserId },
          "Request to book submitted",
        );
      }

      logger.info({ bookingId, mode: loaded.pkg.bookingMode }, "Booking created");
      return { kind: "created" as const, reference, bookingId, status: booking.status, duplicate: false };
    });
  } catch (e) {
    if (isCheckViolation(e, "package_departures_capacity")) {
      throw new AppError(
        "CONFLICT",
        "Those places were just taken. Please choose another departure or fewer travellers.",
      );
    }
    if (isUniqueViolation(e, "bookings_idempotency_uq") || isUniqueViolation(e, "bookings_quote_uq")) {
      const [b] = await db
        .select({ id: bookings.id, reference: bookings.reference, status: bookings.status })
        .from(bookings)
        .where(eq(bookings.quoteId, quote.id));
      if (b) return { kind: "created", bookingId: b.id, reference: b.reference, status: b.status, duplicate: true };
    }
    throw e;
  }
}

/** Used by staff tools and tests: the transaction handle type for callers composing work. */
export type { Tx };
