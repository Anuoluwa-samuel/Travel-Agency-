import { Luggage } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/states";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatMoney, isCurrencyCode, money } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { listBookingsForUser } from "@/server/services/booking/queries";
import { STATUS_LABEL, STATUS_TONE, type BookingStatus } from "@/server/services/booking/transitions";

export const metadata: Metadata = { title: "Your bookings", robots: { index: false } };

export default async function AccountBookingsPage() {
  const user = await requireUser();
  const rows = await listBookingsForUser(user.id);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Your account</p>
        <h1 className="text-3xl">Bookings</h1>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title="No bookings yet"
          description="Bookings you make while signed in appear here. Booked as a guest? Find it with your reference."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/packages">Browse packages</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/booking/lookup">Find a booking</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-white">
          {rows.map((r) => {
            const cur = r.currency.trim();
            const m = (v: bigint) => (isCurrencyCode(cur) ? formatMoney(money(v, cur)) : v.toString());
            return (
              <li key={r.reference} className="relative flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <Link href={`/bookings/${r.reference}`} className="font-medium after:absolute after:inset-0">
                    {r.title ?? r.reference}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {r.reference}
                    {r.travelStart && ` · ${formatDate(r.travelStart)}`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {(r.balanceMinor ?? 0n) > 0n && <span className="tabular">Balance {m(r.balanceMinor ?? 0n)}</span>}
                  <StatusBadge tone={STATUS_TONE[r.status as BookingStatus]}>
                    {STATUS_LABEL[r.status as BookingStatus]}
                  </StatusBadge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
