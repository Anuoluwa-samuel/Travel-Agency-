import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { PrintButton } from "@/components/booking/print-button";
import { SimulatedDataBadge } from "@/components/feedback/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { formatDate } from "@/lib/dates";
import { type CurrencyCode, formatMoney, isCurrencyCode, money } from "@/lib/money";
import { getBookingForViewer } from "@/server/services/booking/access";
import { getBookingDetail } from "@/server/services/booking/queries";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

/** Printable invoice and receipt. A PDF export can be generated from this layout later. */
export default function ReceiptPage(props: PageProps<"/bookings/[ref]/receipt">) {
  return (
    <div className="container-page max-w-3xl py-10 print:py-0">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Receipt params={props.params} />
      </Suspense>
    </div>
  );
}

async function Receipt({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const access = await getBookingForViewer(ref);
  if (!access) notFound();
  const d = (await getBookingDetail(access.booking.id))!;
  const b = d.booking;
  const code = b.currency.trim();
  const cur: CurrencyCode = isCurrencyCode(code) ? code : "NGN";
  const m = (v: bigint) => formatMoney(money(v, cur), { compactZeroMinor: false });
  const simulated = d.transactions.some((t) => t.provider === "mock");

  return (
    <article className="flex flex-col gap-8 rounded-lg border bg-white p-8 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Logo />
          {brand.legal.entityName && <p className="text-sm text-muted-foreground">{brand.legal.entityName}</p>}
          {brand.contact.address && <p className="text-sm text-muted-foreground">{brand.contact.address}</p>}
        </div>
        <div className="text-right text-sm">
          <h1 className="font-sans text-xl font-semibold">
            {d.invoice ? `Invoice ${d.invoice.reference}` : "Booking summary"}
          </h1>
          <p>Booking {b.reference}</p>
          {d.invoice && <p>Issued {formatDate(d.invoice.issuedAt)}</p>}
        </div>
      </header>
      {simulated && <SimulatedDataBadge className="self-start" />}
      <div className="text-sm">
        <p className="font-medium">Billed to</p>
        <p>{b.contactName}</p>
        <p>{b.contactEmail}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left">
          <tr>
            <th scope="col" className="py-2 font-medium">
              Item
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i) => (
            <tr key={i.id} className="border-b">
              <td className="py-2">{i.description}</td>
              <td className="tabular py-2 text-right">{i.quantity}</td>
              <td className="tabular py-2 text-right">{m(i.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-right">
          <tr>
            <th scope="row" colSpan={2} className="pt-3 font-medium">
              Total
            </th>
            <td className="tabular pt-3 font-semibold">{m(b.totalMinor)}</td>
          </tr>
          {d.transactions
            .filter((t) => t.kind === "charge")
            .map((t) => (
              <tr key={t.reference}>
                <th scope="row" colSpan={2} className="pt-1 font-normal">
                  Paid {t.paidAt ? formatDate(t.paidAt) : ""} ({t.reference})
                </th>
                <td className="tabular pt-1">−{m(t.amountMinor)}</td>
              </tr>
            ))}
          <tr>
            <th scope="row" colSpan={2} className="pt-3 font-medium">
              Balance due
            </th>
            <td className="tabular pt-3 font-semibold">{m(b.balanceMinor ?? 0n)}</td>
          </tr>
        </tfoot>
      </table>
      {b.balanceDueDate && (b.balanceMinor ?? 0n) > 0n && (
        <p className="text-sm">Balance due by {formatDate(b.balanceDueDate)}.</p>
      )}
      <PrintButton />
    </article>
  );
}
