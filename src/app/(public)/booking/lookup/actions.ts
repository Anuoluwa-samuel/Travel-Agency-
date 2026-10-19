"use server";

import { redirect } from "next/navigation";
import { guestCodeSchema, guestLookupSchema } from "@/lib/validation/booking";
import { consumeRateLimit } from "@/server/lib/rate-limit";
import { clientIp, privacyHash } from "@/server/lib/request";
import { requestGuestCode, verifyGuestCode } from "@/server/services/booking/guest";

export type LookupState = { step: "request" | "code"; reference: string; error: string | null };

export async function lookupAction(prev: LookupState, formData: FormData): Promise<LookupState> {
  const ip = privacyHash(await clientIp());
  if (!(await consumeRateLimit(`lookup:ip:${ip}`, 10, 600)).allowed) {
    return { ...prev, error: "Too many attempts. Please wait a few minutes." };
  }
  if (formData.get("step") === "code") {
    const parsed = guestCodeSchema.safeParse({ reference: formData.get("reference"), code: formData.get("code") });
    if (!parsed.success) return { ...prev, error: parsed.error.issues[0].message };
    const ref = await verifyGuestCode(parsed.data.reference, parsed.data.code);
    if (!ref)
      return { ...prev, step: "code", error: "That code isn't right or has expired. Request a new one if needed." };
    redirect(`/bookings/${ref}`);
  }
  const parsed = guestLookupSchema.safeParse({ reference: formData.get("reference"), email: formData.get("email") });
  if (!parsed.success)
    return {
      step: "request",
      reference: String(formData.get("reference") ?? ""),
      error: "Enter your booking reference and email.",
    };
  await requestGuestCode(parsed.data.reference, parsed.data.email);
  return { step: "code", reference: parsed.data.reference, error: null };
}
