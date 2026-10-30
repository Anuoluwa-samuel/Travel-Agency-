"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { bookings, paymentAttempts } from "@/server/db/schema";
import { isProduction } from "@/server/env";
import { buildMockChargeEvent } from "@/server/integrations/payments/mock";
import { confirmPaymentReturn, handlePaymentWebhook } from "@/server/services/payments/service";

/**
 * SIMULATED checkout outcome (development and tests only). Produces the same signed event a
 * provider would send and pushes it through the real webhook handler, then verifies the result
 * exactly as the return route does before showing the booking.
 */
export async function simulateCheckout(reference: string, outcome: "success" | "failed") {
  if (isProduction) throw new Error("Simulated checkout is disabled in production");
  const [a] = await db
    .select({
      reference: paymentAttempts.reference,
      amountMinor: paymentAttempts.amountMinor,
      currency: paymentAttempts.currency,
      provider: paymentAttempts.provider,
      bookingId: bookings.id,
      bookingRef: bookings.reference,
    })
    .from(paymentAttempts)
    .innerJoin(bookings, eq(bookings.id, paymentAttempts.bookingId))
    .where(eq(paymentAttempts.reference, reference));
  if (!a || a.provider !== "mock") throw new Error("Unknown simulated payment");
  const evt = buildMockChargeEvent({
    reference: a.reference,
    amountMinor: a.amountMinor,
    currency: a.currency.trim(),
    outcome,
  });
  await handlePaymentWebhook("mock", evt.body, new Headers({ "x-mock-signature": evt.signature }));
  // Same verification the return route performs. Redirecting straight to the booking (rather
  // than via the return route handler) keeps the browser URL correct after a server action.
  const result = await confirmPaymentReturn(a.bookingId, a.reference);
  redirect(`/bookings/${a.bookingRef}?payment=${result.state === "unknown" ? "pending" : result.state}`);
}
