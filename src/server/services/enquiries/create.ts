import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { fromMajor } from "@/lib/money";
import { generateReference } from "@/lib/reference";
import type { EnquiryValues } from "@/lib/validation/enquiry";
import { db } from "@/server/db/client";
import { destinations, enquiries, enquiryMessages, packages } from "@/server/db/schema";
import { getEmailProvider } from "@/server/integrations/email";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enquiryAcknowledgement } from "./emails";

export interface CreateEnquiryContext {
  customerUserId: string | null;
  /** Client-generated key; falls back to a content hash so plain-HTML double submits dedupe too. */
  idempotencyKey?: string;
  attribution?: Record<string, string>;
  now?: Date;
}

export interface CreateEnquiryResult {
  reference: string;
  /** True when this exact submission was already recorded (double click, retry, back button). */
  duplicate: boolean;
  acknowledgementSent: boolean;
}

function derivedKey(v: EnquiryValues, now: Date) {
  // Same person, same content, same 10-minute window = same enquiry.
  const window = Math.floor(now.getTime() / 600_000);
  return createHash("sha256")
    .update([v.email, v.category, v.packageSlug ?? "", v.destinationSlug ?? "", v.message, window].join("|"))
    .digest("hex");
}

function isUniqueViolation(e: unknown, constraint: string) {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const code = err.code ?? err.cause?.code;
  const name = err.constraint_name ?? err.cause?.constraint_name;
  return code === "23505" && name === constraint;
}

/**
 * Records an enquiry and sends the acknowledgement. The acknowledgement is best-effort: a
 * failed email never loses the enquiry, and `acknowledgement_sent_at` is only set when the
 * provider accepted the message.
 */
export async function createEnquiry(v: EnquiryValues, ctx: CreateEnquiryContext): Promise<CreateEnquiryResult> {
  const now = ctx.now ?? new Date();
  const idempotencyKey = ctx.idempotencyKey ? `client:${ctx.idempotencyKey}` : `hash:${derivedKey(v, now)}`;

  const existing = await db
    .select({ reference: enquiries.reference, ack: enquiries.acknowledgementSentAt })
    .from(enquiries)
    .where(eq(enquiries.idempotencyKey, idempotencyKey));
  if (existing[0])
    return { reference: existing[0].reference, duplicate: true, acknowledgementSent: Boolean(existing[0].ack) };

  // Resolve catalogue references server-side; unknown or unpublished slugs are simply ignored.
  const [pkg] = v.packageSlug
    ? await db
        .select({ id: packages.id, title: packages.title, destinationId: packages.primaryDestinationId })
        .from(packages)
        .where(and(eq(packages.slug, v.packageSlug), eq(packages.status, "published")))
    : [];
  const [dest] = v.destinationSlug
    ? await db
        .select({ id: destinations.id, name: destinations.name })
        .from(destinations)
        .where(and(eq(destinations.slug, v.destinationSlug), eq(destinations.status, "published")))
    : [];

  const budget = v.budget ? fromMajor(v.budget.replace(/,/g, ""), v.budgetCurrency) : null;

  let reference = "";
  let inserted: { id: string } | undefined;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    reference = generateReference("enquiry");
    try {
      inserted = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(enquiries)
          .values({
            reference,
            category: v.category,
            customerUserId: ctx.customerUserId,
            contactName: v.name,
            contactEmail: v.email,
            contactPhone: v.phone ?? null,
            preferredContact: v.preferredContact,
            packageId: pkg?.id ?? null,
            destinationId: dest?.id ?? pkg?.destinationId ?? null,
            destinationText: v.destinationText ?? null,
            departureCity: v.departureCity ?? null,
            travelFrom: v.travelFrom ?? null,
            travelTo: v.travelTo ?? null,
            adults: v.adults,
            children: v.children,
            budgetMinor: budget?.amountMinor ?? null,
            budgetCurrency: budget ? budget.currency : null,
            message: v.message,
            source: "web",
            attribution: ctx.attribution ?? null,
            marketingConsent: v.marketingConsent ? now : null,
            idempotencyKey,
          })
          .returning({ id: enquiries.id });
        await tx.insert(enquiryMessages).values({
          enquiryId: row.id,
          authorType: "customer",
          authorId: ctx.customerUserId,
          channel: "web",
          visibility: "customer",
          body: v.message,
        });
        return row;
      });
    } catch (e) {
      if (isUniqueViolation(e, "enquiries_idempotency_uq")) {
        // A concurrent identical submission won the race; return its reference.
        const [row] = await db
          .select({ reference: enquiries.reference })
          .from(enquiries)
          .where(eq(enquiries.idempotencyKey, idempotencyKey));
        return { reference: row.reference, duplicate: true, acknowledgementSent: false };
      }
      if (isUniqueViolation(e, "enquiries_reference_uq")) continue;
      throw e;
    }
  }
  if (!inserted) throw new AppError("CONFLICT", "We couldn't save your enquiry. Please try again.");

  let acknowledgementSent = false;
  try {
    const mail = enquiryAcknowledgement({
      name: v.name,
      reference,
      category: v.category,
      subject: pkg?.title ?? dest?.name ?? null,
    });
    const res = await getEmailProvider().send({ to: v.email, ...mail, idempotencyKey: `enquiry-ack:${inserted.id}` });
    if (res.delivered) {
      await db.update(enquiries).set({ acknowledgementSentAt: new Date() }).where(eq(enquiries.id, inserted.id));
      acknowledgementSent = true;
    }
  } catch (err) {
    logger.error({ err, enquiryId: inserted.id }, "Enquiry acknowledgement email failed");
  }

  logger.info({ enquiryId: inserted.id, category: v.category }, "Enquiry created");
  return { reference, duplicate: false, acknowledgementSent };
}
