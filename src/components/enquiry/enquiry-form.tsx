"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { submitEnquiry, type EnquiryFormState } from "@/app/(public)/contact/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { BUDGET_CURRENCIES, ENQUIRY_CATEGORIES, type EnquiryCategory } from "@/lib/validation/enquiry";
import { cn } from "cn";

const control =
  "border-input h-11 w-full rounded-md border bg-white px-3 text-base md:text-sm aria-invalid:border-status-danger focus-visible:outline-2 focus-visible:outline-offset-2";

export interface EnquiryContext {
  category?: EnquiryCategory;
  destinationSlug?: string;
  destinationName?: string;
  packageSlug?: string;
  packageTitle?: string;
}

/**
 * Enquiry form using a server action. Works without JavaScript (plain POST); with JavaScript it
 * submits in place, keeps input on errors and dedupes double submits with a per-form key.
 */
export function EnquiryForm({ context, sourcePage }: { context: EnquiryContext; sourcePage: string }) {
  const [state, action, pending] = useActionState<EnquiryFormState, FormData>(submitEnquiry, { status: "idle" });
  // One key per form instance, shared by retries and double clicks of the same enquiry. It is
  // written into the hidden input on submit because React resets uncontrolled fields after an
  // action completes. Without JavaScript the server derives a key from the content instead.
  const keyRef = useRef<string | null>(null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    keyRef.current ??= crypto.randomUUID();
    const input = e.currentTarget.elements.namedItem("idempotencyKey");
    if (input instanceof HTMLInputElement) input.value = keyRef.current;
  };

  // Move focus to the confirmation so it is visible and announced after the form disappears.
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
      successRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex scroll-mt-24 flex-col gap-4 rounded-lg border bg-white p-8 outline-none"
      >
        <CheckCircle2 className="size-8 text-status-confirmed" aria-hidden="true" />
        <h2 className="text-2xl">Thanks, we’ve got it</h2>
        <p>
          Your reference is <strong className="font-mono tracking-wide">{state.reference}</strong>.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          {state.acknowledgementSent ? `We've emailed a copy to ${state.email}. ` : "Keep this reference handy. "}A
          consultant will reply, usually within one working day. This is an enquiry, not a booking: nothing is reserved
          or charged until you’ve approved a quote.
        </p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/destinations">Keep exploring</Link>
        </Button>
      </div>
    );
  }

  const err = state.status === "error" ? state.fieldErrors : {};
  const v = state.status === "error" ? state.values : {};
  const category = (v.category as EnquiryCategory) || context.category || "custom_trip";

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
      aria-describedby="privacy-note"
    >
      {state.status === "error" && <FormAlert tone="error" title={state.message} />}
      {(context.packageTitle || context.destinationName) && (
        <p className="rounded-md bg-cloud-100 px-4 py-3 text-sm">
          About: <strong>{context.packageTitle ?? context.destinationName}</strong>
        </p>
      )}

      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <input type="hidden" name="destinationSlug" value={context.destinationSlug ?? ""} />
      <input type="hidden" name="packageSlug" value={context.packageSlug ?? ""} />
      {/* Honeypot, hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <F label="What can we help with?" name="category" error={err.category}>
        {(p) => (
          <select {...p} defaultValue={category} className={control}>
            {Object.entries(ENQUIRY_CATEGORIES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        )}
      </F>

      <div className="grid gap-6 sm:grid-cols-2">
        <F label="Full name" name="name" error={err.name}>
          {(p) => <input {...p} defaultValue={v.name} autoComplete="name" required className={control} />}
        </F>
        <F label="Email" name="email" error={err.email}>
          {(p) => (
            <input {...p} type="email" defaultValue={v.email} autoComplete="email" required className={control} />
          )}
        </F>
        <F label="Phone (optional)" name="phone" error={err.phone} hint="Include the country code, e.g. +234">
          {(p) => <input {...p} type="tel" defaultValue={v.phone} autoComplete="tel" className={control} />}
        </F>
        <F label="Best way to reach you" name="preferredContact" error={err.preferredContact}>
          {(p) => (
            <select {...p} defaultValue={v.preferredContact || "email"} className={control}>
              <option value="email">Email</option>
              <option value="phone">Phone call</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          )}
        </F>
      </div>

      <fieldset className="grid gap-6 border-t pt-6 sm:grid-cols-2">
        <legend className="mb-4 font-heading text-xl text-navy-900">Your trip</legend>
        {!context.destinationName && !context.packageTitle && (
          <F label="Where to? (optional)" name="destinationText" error={err.destinationText}>
            {(p) => (
              <input
                {...p}
                defaultValue={v.destinationText}
                placeholder="e.g. Zanzibar or somewhere warm"
                className={control}
              />
            )}
          </F>
        )}
        <F label="Travelling from (optional)" name="departureCity" error={err.departureCity}>
          {(p) => <input {...p} defaultValue={v.departureCity} placeholder="e.g. Lagos" className={control} />}
        </F>
        <F label="Start date (optional)" name="travelFrom" error={err.travelFrom}>
          {(p) => <input {...p} type="date" defaultValue={v.travelFrom} className={control} />}
        </F>
        <F label="End date (optional)" name="travelTo" error={err.travelTo}>
          {(p) => <input {...p} type="date" defaultValue={v.travelTo} className={control} />}
        </F>
        <F label="Adults" name="adults" error={err.adults}>
          {(p) => (
            <input
              {...p}
              type="number"
              min={0}
              max={99}
              defaultValue={v.adults || "2"}
              inputMode="numeric"
              className={control}
            />
          )}
        </F>
        <F label="Children" name="children" error={err.children}>
          {(p) => (
            <input
              {...p}
              type="number"
              min={0}
              max={99}
              defaultValue={v.children || "0"}
              inputMode="numeric"
              className={control}
            />
          )}
        </F>
        <F label="Total budget (optional)" name="budget" error={err.budget} hint="For the whole group">
          {(p) => (
            <input
              {...p}
              inputMode="decimal"
              defaultValue={v.budget}
              placeholder="e.g. 3,500,000"
              className={control}
            />
          )}
        </F>
        <F label="Budget currency" name="budgetCurrency" error={err.budgetCurrency}>
          {(p) => (
            <select {...p} defaultValue={v.budgetCurrency || "NGN"} className={control}>
              {BUDGET_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </F>
      </fieldset>

      <F
        label="Tell us more"
        name="message"
        error={err.message}
        hint="Interests, must-haves, accessibility or dietary needs"
      >
        {(p) => <textarea {...p} defaultValue={v.message} rows={5} required className={cn(control, "h-auto py-2")} />}
      </F>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="marketingConsent"
          defaultChecked={v.marketingConsent === "on"}
          className="mt-0.5 size-4 accent-navy-900"
        />
        Send me occasional travel ideas and offers. You can unsubscribe at any time.
      </label>

      <p id="privacy-note" className="text-xs leading-relaxed text-muted-foreground">
        We use these details only to respond to your enquiry and plan your trip. Please don’t include passport numbers
        or payment details here.
      </p>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}

function F({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}
