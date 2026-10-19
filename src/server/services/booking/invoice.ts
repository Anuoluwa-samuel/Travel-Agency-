import "server-only";
import type { Tx } from "@/server/db/client";
import { invoices, ledgerEntries, paymentScheduleItems } from "@/server/db/schema";
import { generateReference } from "@/lib/reference";

/**
 * Issues the invoice for a booking once its price is confirmed, with a payment schedule
 * (deposit now + balance by the due date, or a single payment) and the opening ledger entry.
 */
export async function issueInvoice(
  tx: Tx,
  input: {
    bookingId: string;
    currency: string;
    totalMinor: bigint;
    depositMinor: bigint;
    balanceDueDate: string | null;
    now: Date;
    createdBy?: string | null;
  },
) {
  const [inv] = await tx
    .insert(invoices)
    .values({
      reference: generateReference("invoice"),
      bookingId: input.bookingId,
      currency: input.currency,
      totalMinor: input.totalMinor,
      issuedAt: input.now,
    })
    .returning({ id: invoices.id, reference: invoices.reference });

  const split = input.balanceDueDate !== null && input.depositMinor > 0n && input.depositMinor < input.totalMinor;
  const items = split
    ? [
        { label: "Deposit", amountMinor: input.depositMinor, dueAt: input.now, position: 0 },
        {
          label: "Balance",
          amountMinor: input.totalMinor - input.depositMinor,
          dueAt: new Date(`${input.balanceDueDate}T23:59:59+01:00`),
          position: 1,
        },
      ]
    : [{ label: "Full payment", amountMinor: input.totalMinor, dueAt: input.now, position: 0 }];
  if (input.totalMinor > 0n)
    await tx.insert(paymentScheduleItems).values(items.map((i) => ({ ...i, invoiceId: inv.id })));

  await tx.insert(ledgerEntries).values({
    bookingId: input.bookingId,
    invoiceId: inv.id,
    entryType: "charge_due",
    amountMinor: input.totalMinor,
    currency: input.currency,
    memo: `Invoice ${inv.reference} issued`,
    createdBy: input.createdBy ?? null,
  });
  return inv;
}
