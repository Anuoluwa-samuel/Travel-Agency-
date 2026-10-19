"use server";

import { redirect } from "next/navigation";
import { cancellationRequestSchema } from "@/lib/validation/booking";
import { isAppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { getBookingForViewer } from "@/server/services/booking/access";
import { requestCancellation } from "@/server/services/booking/cancel";
import { startPayment } from "@/server/services/payments/service";

export type ActionState = { error: string | null };

/** Starts a payment and sends the browser to the provider's checkout. */
export async function payAction(reference: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getBookingForViewer(reference);
  if (!access || access.viewer.kind === "staff") return { error: "You can't pay for this booking from here." };
  const choice = formData.get("choice") === "full" ? "full" : "next";
  let url: string;
  try {
    const r = await startPayment(
      access.booking.id,
      choice,
      access.viewer.kind === "owner" ? access.viewer.userId : null,
    );
    url = r.checkoutUrl;
  } catch (e) {
    if (isAppError(e)) return { error: e.publicMessage };
    logger.error({ err: e }, "Starting payment failed");
    return { error: "We couldn't start the payment. Please try again." };
  }
  redirect(url);
}

export async function cancelAction(reference: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await getBookingForViewer(reference);
  if (!access) return { error: "That booking could not be found." };
  const parsed = cancellationRequestSchema.safeParse({
    reason: formData.get("reason"),
    confirm: formData.get("confirm") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await requestCancellation(access.booking.id, {
      reason: parsed.data.reason,
      actor:
        access.viewer.kind === "owner"
          ? { type: "customer", id: access.viewer.userId }
          : access.viewer.kind === "staff"
            ? { type: "staff", id: access.viewer.userId }
            : { type: "customer", id: null },
    });
  } catch (e) {
    if (isAppError(e)) return { error: e.publicMessage };
    throw e;
  }
  redirect(`/bookings/${access.booking.reference}?cancel=requested`);
}
