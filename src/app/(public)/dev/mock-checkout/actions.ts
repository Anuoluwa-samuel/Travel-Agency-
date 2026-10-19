"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { bookings, paymentAttempts } from "@/server/db/schema";
import { isProduction } from "@/server/env";
import { buildMockChargeEvent } from "@/server/integrations/payments/mock";
import { handlePaymentWebhook } from "@/server/services/payments/service";

/**
 * SIMULATED checkout outcome (development and tests only). Produces the same signed event a
 * provider would send and pushes it through the real webhook handler, then returns the
 * customer to the normal return URL, where the result is verified like any other payment.
 */
export async function simulateCheckout(reference: string, outcome: "success" | "failed") {
  if (isProduction) throw new Error("Simulated checkout is disabled in production");
  const [a] = await db
    .select({
      reference: paymentAttempts.reference,
      amountMinor: paymentAttempts.amountMinor,
      currency: paymentAttempts.currency,
      provider: paymentAttempts.provider,
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
  redirect(`/bookings/${a.bookingRef}/payment-return?reference=${a.reference}`);
}
