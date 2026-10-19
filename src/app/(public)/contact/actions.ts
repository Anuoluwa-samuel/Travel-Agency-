"use server";

import { enquirySchema } from "@/lib/validation/enquiry";
import { getCurrentUser } from "@/server/auth/session";
import { isAppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { consumeRateLimit } from "@/server/lib/rate-limit";
import { clientIp, privacyHash } from "@/server/lib/request";
import { createEnquiry } from "@/server/services/enquiries/create";

export type EnquiryFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string>; values: Record<string, string> }
  | { status: "success"; reference: string; email: string; acknowledgementSent: boolean };

const FIELDS = [
  "category",
  "name",
  "email",
  "phone",
  "preferredContact",
  "destinationSlug",
  "packageSlug",
  "destinationText",
  "departureCity",
  "travelFrom",
  "travelTo",
  "adults",
  "children",
  "budget",
  "budgetCurrency",
  "message",
  "marketingConsent",
] as const;

export async function submitEnquiry(_prev: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")])) as Record<string, string>;
  const fail = (message: string, fieldErrors: Record<string, string> = {}): EnquiryFormState => ({
    status: "error",
    message,
    fieldErrors,
    values,
  });

  // Honeypot: real visitors never see or fill this field. Pretend success so bots learn nothing.
  if (String(formData.get("website") ?? "") !== "") {
    return { status: "success", reference: "EQ-0000-0000", email: values.email, acknowledgementSent: false };
  }

  const parsed = enquirySchema.safeParse({
    ...values,
    marketingConsent: formData.get("marketingConsent") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return fail("Please check the highlighted fields.", fieldErrors);
  }

  const ip = privacyHash(await clientIp());
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`enquiry:ip:${ip}`, 8, 600),
    consumeRateLimit(`enquiry:email:${privacyHash(parsed.data.email)}`, 4, 600),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return fail("You've sent several enquiries in a short time. Please wait a few minutes and try again.");
  }

  const user = await getCurrentUser();
  const key = String(formData.get("idempotencyKey") ?? "");
  try {
    const result = await createEnquiry(parsed.data, {
      customerUserId: user?.id ?? null,
      idempotencyKey: /^[0-9a-f-]{36}$/i.test(key) ? key : undefined,
      attribution: { page: String(formData.get("sourcePage") ?? "").slice(0, 200) },
    });
    return {
      status: "success",
      reference: result.reference,
      email: parsed.data.email,
      acknowledgementSent: result.acknowledgementSent,
    };
  } catch (e) {
    if (isAppError(e)) return fail(e.publicMessage);
    logger.error({ err: e }, "Enquiry submission failed");
    return fail("Something went wrong on our side and your enquiry wasn't sent. Please try again.");
  }
}
