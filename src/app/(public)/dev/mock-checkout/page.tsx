import { eq } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SimulatedDataBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, isCurrencyCode, money } from "@/lib/money";
import { db } from "@/server/db/client";
import { bookings, paymentAttempts } from "@/server/db/schema";
import { isProduction } from "@/server/env";
import { simulateCheckout } from "./actions";

export const metadata: Metadata = { title: "Simulated checkout", robots: { index: false, follow: false } };

export default function MockCheckoutPage(props: PageProps<"/dev/mock-checkout">) {
  return (
    <div className="container-page flex max-w-lg flex-col gap-6 py-14">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Checkout searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Checkout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (isProduction) notFound();
  const sp = await searchParams;
  const ref = typeof sp.reference === "string" ? sp.reference : "";
  const [a] = await db
    .select({
      reference: paymentAttempts.reference,
      amountMinor: paymentAttempts.amountMinor,
      currency: paymentAttempts.currency,
      provider: paymentAttempts.provider,
      status: paymentAttempts.status,
      bookingRef: bookings.reference,
    })
    .from(paymentAttempts)
    .innerJoin(bookings, eq(bookings.id, paymentAttempts.bookingId))
    .where(eq(paymentAttempts.reference, ref));
  if (!a || a.provider !== "mock") notFound();
  const cur = a.currency.trim();

  return (
    <div className="flex flex-col gap-6 rounded-lg border-2 border-dashed border-navy-300 bg-white p-8">
      <div className="flex items-center gap-3">
        <FlaskConical className="size-6 text-navy-700" aria-hidden="true" />
        <h1 className="font-sans text-xl font-semibold">Simulated checkout</h1>
      </div>
      <SimulatedDataBadge className="self-start" />
      <p className="text-sm">
        This page stands in for Paystack until test keys are configured. No card is charged and no money moves. The
        result is processed by the same webhook code a real payment uses.
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Booking</dt>
        <dd className="font-mono">{a.bookingRef}</dd>
        <dt className="text-muted-foreground">Payment</dt>
        <dd className="font-mono">{a.reference}</dd>
        <dt className="text-muted-foreground">Amount</dt>
        <dd className="tabular font-semibold">
          {isCurrencyCode(cur)
            ? formatMoney(money(a.amountMinor, cur), { compactZeroMinor: false })
            : a.amountMinor.toString()}
        </dd>
      </dl>
      {a.status === "succeeded" ? (
        <p className="text-sm">This simulated payment has already been completed.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <form action={simulateCheckout.bind(null, a.reference, "success")}>
            <Button type="submit">Simulate successful payment</Button>
          </form>
          <form action={simulateCheckout.bind(null, a.reference, "failed")}>
            <Button type="submit" variant="outline">
              Simulate failed payment
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
