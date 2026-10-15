"use server";

import { consultationBookingSchema } from "@/lib/validation/consultation";
import { getCurrentUser } from "@/server/auth/session";
import { isAppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { consumeRateLimit } from "@/server/lib/rate-limit";
import { clientIp, privacyHash } from "@/server/lib/request";
import { bookConsultation } from "@/server/services/consultations/service";

export type BookingFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      values: Record<string, string>;
      slotTaken?: boolean;
    }
  | {
      status: "success";
      reference: string;
      startsAt: string;
      serviceName: string;
      email: string;
      confirmationSent: boolean;
    };

const FIELDS = ["serviceSlug", "startsAt", "format", "name", "email", "phone", "notes", "timezone"] as const;

export async function submitBooking(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")])) as Record<string, string>;
  const fail = (message: string, fieldErrors: Record<string, string> = {}, slotTaken = false): BookingFormState => ({
    status: "error",
    message,
    fieldErrors,
    values,
    slotTaken,
  });

  if (String(formData.get("website") ?? "") !== "") return fail("Something went wrong. Please try again.");

  const parsed = consultationBookingSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return fail("Please check the highlighted fields.", fieldErrors);
  }

  const ip = privacyHash(await clientIp());
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`consult:ip:${ip}`, 6, 600),
    consumeRateLimit(`consult:email:${privacyHash(parsed.data.email)}`, 3, 600),
  ]);
  if (!byIp.allowed || !byEmail.allowed)
    return fail("Too many booking attempts. Please wait a few minutes and try again.");

  const user = await getCurrentUser();
  const key = String(formData.get("idempotencyKey") ?? "");
  try {
    const r = await bookConsultation(parsed.data, {
      customerUserId: user?.id ?? null,
      idempotencyKey: /^[0-9a-f-]{36}$/i.test(key) ? key : undefined,
    });
    return {
      status: "success",
      reference: r.reference,
      startsAt: r.startsAt.toISOString(),
      serviceName: r.serviceName,
      email: parsed.data.email,
      confirmationSent: r.confirmationSent,
    };
  } catch (e) {
    if (isAppError(e)) return fail(e.publicMessage, {}, e.code === "CONFLICT");
    logger.error({ err: e }, "Consultation booking failed");
    return fail("Something went wrong on our side and nothing was booked. Please try again.");
  }
}
