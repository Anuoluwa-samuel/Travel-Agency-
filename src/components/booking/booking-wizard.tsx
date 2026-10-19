"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { bookAction, quoteAction, type QuoteView } from "@/app/(public)/packages/[slug]/book/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { type CurrencyCode, formatMoney, money } from "@/lib/money";
import { cn } from "cn";

export interface WizardPackage {
  slug: string;
  title: string;
  bookingMode: "instant" | "request" | "enquiry";
  maxPax: number;
  rooms: { id: string; name: string; occupancy: number | null }[];
  addons: { id: string; name: string }[];
  departures: { id: string; startDate: string; endDate: string; availability: "open" | "limited" | "closed" }[];
  cancellationTitle: string | null;
  cancellationBody: string | null;
}

type Room = { optionId: string; adults: number; children: number };
type Traveller = {
  type: "adult" | "child";
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
};

const control =
  "border-input h-11 w-full rounded-md border bg-white px-3 text-base md:text-sm aria-invalid:border-status-danger focus-visible:outline-2 focus-visible:outline-offset-2";

const fmt = (minor: string, currency: string) => formatMoney(money(BigInt(minor), currency as CurrencyCode));

/**
 * Two steps: (1) dates, rooms and extras → server quote; (2) travellers and contact → booking.
 * Every amount on screen comes from the server quote; changing the selection clears it.
 */
export function BookingWizard({ pkg }: { pkg: WizardPackage }) {
  const bookable = pkg.departures.filter((d) => d.availability !== "closed");
  const [departureId, setDepartureId] = useState(bookable[0]?.id ?? "");
  const [rooms, setRooms] = useState<Room[]>([
    { optionId: pkg.rooms[0]?.id ?? "", adults: Math.min(2, pkg.rooms[0]?.occupancy ?? 1), children: 0 },
  ]);
  const [addons, setAddons] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const quoteHeading = useRef<HTMLHeadingElement>(null);

  const pax = rooms.reduce((s, r) => s + r.adults + r.children, 0);
  const invalidate = () => {
    setQuote(null);
    setError(null);
  };
  const updateRoom = (i: number, patch: Partial<Room>) => {
    invalidate();
    setRooms((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  };

  function getPrice() {
    start(async () => {
      const res = await quoteAction(pkg.slug, {
        departureId,
        rooms,
        addons: Object.entries(addons)
          .filter(([, n]) => n > 0)
          .map(([optionId, travellers]) => ({ optionId, travellers })),
      });
      if (res.ok) {
        setQuote(res.quote);
        setError(null);
        requestAnimationFrame(() => quoteHeading.current?.focus());
      } else {
        setQuote(null);
        setError(res.error);
      }
    });
  }

  if (bookable.length === 0) {
    return <FormAlert tone="error" title="No departures are open for online booking right now." />;
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="step1" className="flex flex-col gap-6">
        <h2 id="step1" className="text-2xl">
          1. Dates and rooms
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Departure</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {bookable.map((d) => (
              <label
                key={d.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-white px-4 py-3 text-sm has-[:checked]:border-navy-900 has-[:checked]:bg-navy-100/50"
              >
                <input
                  type="radio"
                  name="departure"
                  value={d.id}
                  checked={departureId === d.id}
                  onChange={() => {
                    invalidate();
                    setDepartureId(d.id);
                  }}
                  className="accent-navy-900"
                />
                <span>
                  {formatDate(d.startDate, { year: undefined })} – {formatDate(d.endDate)}
                  {d.availability === "limited" && (
                    <span className="block text-xs text-status-pending">Few places left</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Rooms</legend>
          {rooms.map((r, i) => {
            const opt = pkg.rooms.find((o) => o.id === r.optionId);
            const maxAdults = opt?.occupancy ?? 1;
            return (
              <div
                key={i}
                className="grid items-end gap-3 rounded-md border bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <label className="flex flex-col gap-1 text-sm">
                  Room {i + 1}
                  <select
                    className={control}
                    value={r.optionId}
                    onChange={(e) => {
                      const next = pkg.rooms.find((o) => o.id === e.target.value);
                      updateRoom(i, { optionId: e.target.value, adults: Math.min(r.adults, next?.occupancy ?? 1) });
                    }}
                  >
                    {pkg.rooms.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Stepper
                  label="Adults"
                  value={r.adults}
                  min={1}
                  max={maxAdults}
                  onChange={(v) => updateRoom(i, { adults: v })}
                />
                <Stepper
                  label="Children"
                  value={r.children}
                  min={0}
                  max={1}
                  onChange={(v) => updateRoom(i, { children: v })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove room ${i + 1}`}
                  disabled={rooms.length === 1}
                  onClick={() => {
                    invalidate();
                    setRooms((rs) => rs.filter((_, k) => k !== i));
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={pax >= pkg.maxPax}
            onClick={() => {
              invalidate();
              setRooms((rs) => [...rs, { optionId: pkg.rooms[0].id, adults: 1, children: 0 }]);
            }}
          >
            <Plus data-icon="inline-start" /> Add a room
          </Button>
        </fieldset>

        {pkg.addons.length > 0 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">Optional extras (number of people)</legend>
            {pkg.addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 rounded-md border bg-white px-4 py-2">
                <span className="text-sm">{a.name}</span>
                <Stepper
                  label={`${a.name}: people`}
                  hideLabel
                  value={addons[a.id] ?? 0}
                  min={0}
                  max={pax}
                  onChange={(v) => {
                    invalidate();
                    setAddons((s) => ({ ...s, [a.id]: v }));
                  }}
                />
              </div>
            ))}
          </fieldset>
        )}

        {error && <FormAlert tone="error" title={error} />}
        {!quote && (
          <Button type="button" size="lg" onClick={getPrice} disabled={pending || !departureId} className="self-start">
            {pending ? "Checking price…" : "See price"}
          </Button>
        )}
      </section>

      {quote && (
        <>
          <section aria-labelledby="quote-h" className="flex flex-col gap-4 rounded-lg border bg-white p-6">
            <h2 id="quote-h" ref={quoteHeading} tabIndex={-1} className="text-2xl outline-none">
              Your price
            </h2>
            <table className="w-full text-sm">
              <caption className="sr-only">Price breakdown</caption>
              <tbody>
                {quote.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <th scope="row" className="py-2 text-left font-normal">
                      {l.description}
                      {l.quantity > 1 && <span className="text-muted-foreground"> × {l.quantity}</span>}
                    </th>
                    <td className="tabular py-2 text-right">{fmt(l.totalMinor, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="pt-3 text-left text-base">
                    Total
                  </th>
                  <td className="tabular pt-3 text-right text-xl font-semibold">
                    {fmt(quote.totalMinor, quote.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="text-sm text-muted-foreground">
              {quote.bookingMode === "instant"
                ? quote.depositMinor === quote.totalMinor
                  ? "Full payment is due now to secure your places."
                  : `Pay a deposit of ${fmt(quote.depositMinor, quote.currency)} now; the balance is due by ${formatDate(quote.balanceDueDate!)}.`
                : `No payment now. We confirm availability with our partners first; a deposit of ${fmt(quote.depositMinor, quote.currency)} will then secure your places.`}{" "}
              This price is held for 24 hours.
            </p>
            <Button type="button" variant="link" className="self-start px-0" onClick={invalidate}>
              Change dates or rooms
            </Button>
          </section>
          <TravellerStep key={quote.reference} pkg={pkg} quote={quote} />
        </>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hideLabel = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span id={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Fewer: ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus />
        </Button>
        <output aria-live="polite" className="tabular w-8 text-center">
          {value}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`More: ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function TravellerStep({ pkg, quote }: { pkg: WizardPackage; quote: QuoteView }) {
  const initial: Traveller[] = [
    ...Array.from({ length: quote.adults }, () => ({
      type: "adult" as const,
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      nationality: "",
      passportNumber: "",
    })),
    ...Array.from({ length: quote.children }, () => ({
      type: "child" as const,
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      nationality: "",
      passportNumber: "",
    })),
  ];
  const [travellers, setTravellers] = useState<Traveller[]>(initial);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState<{
    oldTotalMinor: string;
    newTotalMinor: string;
    quoteReference: string;
  } | null>(null);
  const [pending, start] = useTransition();
  const keyRef = useRef<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    keyRef.current ??= crypto.randomUUID();
    start(async () => {
      const res = await bookAction(
        {
          quoteReference: changed?.quoteReference ?? quote.reference,
          contact,
          travellers: travellers.map((t) => ({ ...t, title: undefined })),
          notes,
          acceptTerms: accept,
        },
        keyRef.current!,
      );
      // On success the action redirects; anything returned is a problem to show.
      if ("priceChanged" in res) {
        setChanged(res.priceChanged);
        keyRef.current = null;
        setMessage(null);
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setMessage(res.error);
    });
  }

  const err = (k: string) => errors[k];
  const set = (i: number, patch: Partial<Traveller>) =>
    setTravellers((ts) => ts.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8" aria-labelledby="step2">
      <h2 id="step2" className="text-2xl">
        2. Who’s travelling
      </h2>
      {message && <FormAlert tone="error" title={message} />}
      {changed && (
        <FormAlert tone="error" title="The price changed while you were booking">
          New total {fmt(changed.newTotalMinor, quote.currency)} (was {fmt(changed.oldTotalMinor, quote.currency)}).
          Submit again to accept the new price.
        </FormAlert>
      )}

      {travellers.map((t, i) => (
        <fieldset key={i} className="grid gap-4 rounded-md border bg-white p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">
            Traveller {i + 1} ({t.type}){i === 0 && " · lead traveller"}
          </legend>
          <Field label="First name (as on passport)" error={err(`travellers.${i}.firstName`)}>
            {(p) => (
              <input
                {...p}
                className={control}
                autoComplete={i === 0 ? "given-name" : "off"}
                value={t.firstName}
                onChange={(e) => set(i, { firstName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Last name (as on passport)" error={err(`travellers.${i}.lastName`)}>
            {(p) => (
              <input
                {...p}
                className={control}
                autoComplete={i === 0 ? "family-name" : "off"}
                value={t.lastName}
                onChange={(e) => set(i, { lastName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Date of birth (optional now)" error={err(`travellers.${i}.dateOfBirth`)}>
            {(p) => (
              <input
                {...p}
                type="date"
                className={control}
                value={t.dateOfBirth}
                onChange={(e) => set(i, { dateOfBirth: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Passport number (optional now)"
            error={err(`travellers.${i}.passportNumber`)}
            hint="Stored encrypted. You can add it later."
          >
            {(p) => (
              <input
                {...p}
                className={control}
                autoComplete="off"
                value={t.passportNumber}
                onChange={(e) => set(i, { passportNumber: e.target.value })}
              />
            )}
          </Field>
        </fieldset>
      ))}

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Contact for this booking</legend>
        <Field label="Full name" error={err("contact.name")}>
          {(p) => (
            <input
              {...p}
              className={control}
              autoComplete="name"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
            />
          )}
        </Field>
        <Field label="Email" error={err("contact.email")}>
          {(p) => (
            <input
              {...p}
              type="email"
              className={control}
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
          )}
        </Field>
        <Field label="Phone" error={err("contact.phone")}>
          {(p) => (
            <input
              {...p}
              type="tel"
              className={control}
              autoComplete="tel"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            />
          )}
        </Field>
      </fieldset>

      <Field label="Anything we should know? (optional)" error={err("notes")}>
        {(p) => (
          <textarea
            {...p}
            rows={3}
            className={cn(control, "h-auto py-2")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </Field>

      {pkg.cancellationTitle && (
        <details className="rounded-md border bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium">{pkg.cancellationTitle}</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{pkg.cancellationBody}</p>
        </details>
      )}
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 size-4 accent-navy-900"
            aria-invalid={err("acceptTerms") ? true : undefined}
          />
          I’ve read the cancellation terms above and agree to them.
        </label>
        {err("acceptTerms") && <p className="text-sm text-status-danger">{err("acceptTerms")}</p>}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Booking…" : pkg.bookingMode === "instant" ? "Book and continue to payment" : "Send booking request"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {pkg.bookingMode === "instant"
          ? "Your places are held for 30 minutes while you pay."
          : "We hold your places for 72 hours while we confirm. Nothing is charged until you approve the confirmed booking."}
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (p: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : null, error ? `${id}-e` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={`${id}-h`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-e`} className="text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}
