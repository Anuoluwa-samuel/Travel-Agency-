import { CalendarDays, FileText, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CancelForm, PayForm } from "@/components/booking/booking-actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SimulatedDataBadge, StatusBadge } from "@/components/feedback/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates";
import { type CurrencyCode, formatMoney, isCurrencyCode, money } from "@/lib/money";
import { onlinePaymentsAvailable, getPaymentProvider } from "@/server/integrations/payments";
import { getBookingForViewer } from "@/server/services/booking/access";
import { previewCancellation } from "@/server/services/booking/cancel";
import { getBookingDetail } from "@/server/services/booking/queries";
import {
  CANCELLABLE,
  PAYABLE,
  STATUS_LABEL,
  STATUS_TONE,
  type BookingStatus,
} from "@/server/services/booking/transitions";
import { payableAmounts } from "@/server/services/payments/service";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

export default function BookingPage(props: PageProps<"/bookings/[ref]">) {
  return (
    <div className="container-page flex max-w-4xl flex-col gap-8 py-10 md:py-14">
      <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
        <Booking params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Booking({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  const access = await getBookingForViewer(ref);
  if (!access) notFound();
  const d = (await getBookingDetail(access.booking.id))!;
  const b = d.booking;
  const status = b.status as BookingStatus;
  const code = b.currency.trim();
  const cur: CurrencyCode = isCurrencyCode(code) ? code : "NGN";
  const m = (v: bigint) => formatMoney(money(v, cur), { compactZeroMinor: false });

  const payable =
    PAYABLE.has(status) && access.viewer.kind !== "staff" && onlinePaymentsAvailable()
      ? await payableAmounts(b.id)
      : null;
  const simulated = payable ? getPaymentProvider().simulated : false;
  const cancelPreview =
    CANCELLABLE.has(status) && !d.cancellation?.status.match(/submitted/) ? await previewCancellation(b.id) : null;
  const paymentParam = typeof sp.payment === "string" ? sp.payment : null;

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">Booking {b.reference}</p>
        <h1 className="text-3xl md:text-4xl">{d.pkg?.title ?? "Your trip"}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
          {d.transactions.some((t) => t.provider === "mock") && <SimulatedDataBadge />}
        </div>
      </header>

      {sp.new === "1" && (
        <FormAlert tone="success" title={status === "request_submitted" ? "Request received" : "Booking created"}>
          {status === "request_submitted"
            ? "We're confirming availability with our partners and will email you within one working day. Nothing has been charged."
            : "Your places are held for 30 minutes while you pay the deposit."}{" "}
          Keep your reference: <strong className="font-mono">{b.reference}</strong>.
        </FormAlert>
      )}
      {paymentParam === "paid" && <FormAlert tone="success" title="Payment received. Thank you!" />}
      {paymentParam === "pending" && (
        <FormAlert tone="success" title="We're waiting for confirmation from the payment provider">
          This usually takes a few moments. Refresh this page shortly; we’ll also email you when it’s confirmed.
        </FormAlert>
      )}
      {paymentParam === "failed" && (
        <FormAlert tone="error" title="The payment didn't go through. Nothing was charged; you can try again." />
      )}
      {sp.cancel === "requested" && (
        <FormAlert tone="success" title="Cancellation requested. Our team will confirm by email." />
      )}

      <dl className="grid gap-6 rounded-lg border bg-white p-6 sm:grid-cols-3">
        <div className="flex gap-3">
          <CalendarDays className="mt-0.5 size-5 text-gold-700" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Dates</dt>
            <dd>
              {b.travelStart && b.travelEnd
                ? `${formatDate(b.travelStart, { year: undefined })} – ${formatDate(b.travelEnd)}`
                : "To be confirmed"}
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Users className="mt-0.5 size-5 text-gold-700" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Travellers</dt>
            <dd>
              {b.adults} adult{b.adults > 1 && "s"}
              {b.children > 0 && `, ${b.children} child${b.children > 1 ? "ren" : ""}`}
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <FileText className="mt-0.5 size-5 text-gold-700" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Balance</dt>
            <dd className="tabular">
              {m(b.balanceMinor ?? 0n)} <span className="text-sm text-muted-foreground">of {m(b.totalMinor)}</span>
            </dd>
          </div>
        </div>
      </dl>

      {payable && (
        <section aria-labelledby="pay" className="flex flex-col gap-4">
          <h2 id="pay" className="text-2xl">
            Payment
          </h2>
          <PayForm
            reference={b.reference}
            nextLabel={payable.next.label}
            nextAmount={m(payable.next.amountMinor)}
            fullAmount={m(payable.full.amountMinor)}
            showFull={payable.full.amountMinor > payable.next.amountMinor}
            simulated={simulated}
          />
        </section>
      )}
      {PAYABLE.has(status) && !onlinePaymentsAvailable() && (
        <FormAlert tone="error" title="Online payment isn't available yet">
          Our team will send you a secure payment link. Quote {b.reference}.
        </FormAlert>
      )}

      <section aria-labelledby="price" className="flex flex-col gap-3">
        <h2 id="price" className="text-2xl">
          What you’re paying for
        </h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Booking items</caption>
          <tbody>
            {d.items.map((i) => (
              <tr key={i.id} className="border-b">
                <th scope="row" className="py-2 text-left font-normal">
                  {i.description}
                  {i.quantity > 1 && <span className="text-muted-foreground"> × {i.quantity}</span>}
                </th>
                <td className="py-2 text-right">
                  <StatusBadge
                    tone={
                      i.confirmationStatus === "confirmed"
                        ? "confirmed"
                        : i.confirmationStatus === "cancelled"
                          ? "danger"
                          : "pending"
                    }
                  >
                    {i.confirmationStatus === "requested"
                      ? "Awaiting confirmation"
                      : i.confirmationStatus === "held"
                        ? "Held"
                        : i.confirmationStatus === "confirmed"
                          ? "Confirmed"
                          : "Cancelled"}
                  </StatusBadge>
                </td>
                <td className="tabular py-2 text-right">{m(i.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.schedule.length > 0 && (
          <>
            <h3 className="mt-4 text-lg">Payment schedule</h3>
            <ul className="divide-y rounded-lg border bg-white text-sm">
              {d.schedule.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span>
                    {s.label} <span className="text-muted-foreground">· due {formatDate(s.dueAt)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular">{m(s.amountMinor)}</span>
                    <StatusBadge tone={s.status === "paid" ? "confirmed" : "pending"}>
                      {s.status === "paid" ? "Paid" : "Due"}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {d.transactions.length > 0 && (
          <Link
            href={`/bookings/${b.reference}/receipt`}
            className="self-start text-sm text-navy-700 underline underline-offset-4"
          >
            View receipt
          </Link>
        )}
      </section>

      <section aria-labelledby="who" className="flex flex-col gap-3">
        <h2 id="who" className="text-2xl">
          Travellers
        </h2>
        <ul className="divide-y rounded-lg border bg-white text-sm">
          {d.travellers.map((t, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                {t.firstName} {t.lastName}
                {t.isLead === 1 && <span className="text-muted-foreground"> · lead</span>}
              </span>
              <span className="text-muted-foreground">
                {t.passportLast4 ? `Passport ending ${t.passportLast4}` : "Passport details needed before travel"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {d.cancellation?.status === "submitted" && (
        <FormAlert tone="success" title="Cancellation request under review">
          Estimated charge {m(d.cancellation.penaltyMinor)}; estimated refund {m(d.cancellation.refundableMinor)}. Our
          team will confirm.
        </FormAlert>
      )}
      {cancelPreview && (
        <details className="rounded-lg border bg-white p-6">
          <summary className="cursor-pointer font-medium">Cancel this booking</summary>
          <div className="mt-4 flex flex-col gap-4">
            {d.policy && (
              <details className="text-sm">
                <summary className="cursor-pointer">{d.policy.title}</summary>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{d.policy.body}</p>
              </details>
            )}
            <CancelForm
              reference={b.reference}
              summary={
                cancelPreview.manualReview
                  ? "Our team will calculate any charges under your booking terms and confirm before anything is final."
                  : `If you cancel today (${cancelPreview.result.daysBeforeDeparture} days before departure), the charge is ${m(cancelPreview.result.penaltyMinor)} and the estimated refund is ${m(cancelPreview.result.refundableMinor)}.`
              }
            />
          </div>
        </details>
      )}

      <section aria-labelledby="history" className="flex flex-col gap-3">
        <h2 id="history" className="text-xl">
          History
        </h2>
        <ol className="flex flex-col gap-1 text-sm text-muted-foreground">
          {d.history
            .filter((h) => h.to !== "draft")
            .map((h, i) => (
              <li key={i}>
                {formatDate(h.at, { hour: "2-digit", minute: "2-digit" })} · {STATUS_LABEL[h.to as BookingStatus]}
              </li>
            ))}
        </ol>
      </section>
    </article>
  );
}
