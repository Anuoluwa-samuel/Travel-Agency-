"use server";

import { redirect } from "next/navigation";
import { bookingRequestSchema, selectionSchema } from "@/lib/validation/booking";
import { getCurrentUser } from "@/server/auth/session";
import { isAppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { consumeRateLimit } from "@/server/lib/rate-limit";
import { clientIp, privacyHash } from "@/server/lib/request";
import { grantGuestAccess } from "@/server/services/booking/access";
import { createBookingFromQuote, createQuote } from "@/server/services/booking/create";

export interface QuoteView {
  reference: string;
  currency: string;
  lines: { description: string; quantity: number; unitMinor: string; totalMinor: string }[];
  totalMinor: string;
  depositMinor: string;
  balanceDueDate: string | null;
  adults: number;
  children: number;
  expiresAt: string;
  bookingMode: "instant" | "request" | "enquiry";
}

export type QuoteState = { ok: true; quote: QuoteView } | { ok: false; error: string };

/** Prices a selection on the server. Amounts are serialised as strings (bigint-safe). */
export async function quoteAction(packageSlug: string, raw: unknown): Promise<QuoteState> {
  const parsed = selectionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your selection." };
  const ip = privacyHash(await clientIp());
  if (!(await consumeRateLimit(`quote:ip:${ip}`, 60, 600)).allowed)
    return { ok: false, error: "Too many price checks. Please wait a few minutes." };
  try {
    const user = await getCurrentUser();
    const { quote, result, bookingMode } = await createQuote(packageSlug, parsed.data, {
      customerUserId: user?.id ?? null,
    });
    return {
      ok: true,
      quote: {
        reference: quote.reference,
        currency: result.currency,
        lines: result.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitMinor: l.unitMinor.toString(),
          totalMinor: l.totalMinor.toString(),
        })),
        totalMinor: result.totalMinor.toString(),
        depositMinor: result.depositMinor.toString(),
        balanceDueDate: result.balanceDueDate,
        adults: result.adults,
        children: result.children,
        expiresAt: quote.expiresAt.toISOString(),
        bookingMode,
      },
    };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.publicMessage };
    logger.error({ err: e }, "Quote failed");
    return { ok: false, error: "We couldn't price that just now. Please try again." };
  }
}

export type BookState =
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | { ok: false; priceChanged: { quoteReference: string; oldTotalMinor: string; newTotalMinor: string } };

/** Creates the booking from an accepted quote, then sends the customer to it. */
export async function bookAction(raw: unknown, idempotencyKey: string): Promise<BookState> {
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const ip = privacyHash(await clientIp());
  if (!(await consumeRateLimit(`book:ip:${ip}`, 10, 600)).allowed)
    return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  let reference: string;
  try {
    const user = await getCurrentUser();
    const res = await createBookingFromQuote(parsed.data, {
      customerUserId: user?.id ?? null,
      idempotencyKey: /^[0-9a-f-]{36}$/i.test(idempotencyKey) ? idempotencyKey : undefined,
    });
    if (res.kind === "price_changed") {
      return {
        ok: false,
        priceChanged: {
          quoteReference: res.newQuoteReference,
          oldTotalMinor: res.oldTotalMinor.toString(),
          newTotalMinor: res.newTotalMinor.toString(),
        },
      };
    }
    // The person who just booked can view it without an account.
    if (!user) await grantGuestAccess(res.bookingId);
    reference = res.reference;
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.publicMessage };
    logger.error({ err: e }, "Booking failed");
    return { ok: false, error: "Something went wrong and nothing was booked. Please try again." };
  }
  redirect(`/bookings/${reference}?new=1`);
}
