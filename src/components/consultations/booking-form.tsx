"use client";

import { CalendarCheck2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { submitBooking, type BookingFormState } from "@/app/(public)/consultations/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { FORMAT_LABELS, type ConsultationFormat } from "@/lib/validation/consultation";
import { formatInZone } from "@/lib/zoned-time";
import { cn } from "cn";
import { useVisitorTimeZone } from "./local-time";

const control =
  "border-input h-11 w-full rounded-md border bg-white px-3 text-base md:text-sm aria-invalid:border-status-danger focus-visible:outline-2 focus-visible:outline-offset-2";

export function BookingForm({
  serviceSlug,
  startsAt,
  formats,
  businessTz,
}: {
  serviceSlug: string;
  startsAt: string;
  formats: ConsultationFormat[];
  businessTz: string;
}) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(submitBooking, { status: "idle" });
  const visitorTz = useVisitorTimeZone(businessTz);
  const keyRef = useRef<string | null>(null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    keyRef.current ??= crypto.randomUUID();
    const form = e.currentTarget;
    (form.elements.namedItem("idempotencyKey") as HTMLInputElement).value = keyRef.current;
    (form.elements.namedItem("timezone") as HTMLInputElement).value = visitorTz;
  };

  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
      successRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [state.status]);

  if (state.status === "success") {
    const when = (tz: string) =>
      formatInZone(state.startsAt, tz, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex scroll-mt-24 flex-col gap-4 rounded-lg border bg-white p-8 outline-none"
      >
        <CalendarCheck2 className="size-8 text-status-confirmed" aria-hidden="true" />
        <h2 className="text-2xl">You’re booked</h2>
        <p>
          {state.serviceName} on <strong>{when(visitorTz)}</strong>
          {visitorTz !== businessTz && <span className="text-muted-foreground"> ({when(businessTz)} in Lagos)</span>}.
        </p>
        <p>
          Reference <strong className="font-mono tracking-wide">{state.reference}</strong>.{" "}
          {state.confirmationSent ? `We've emailed the details to ${state.email}.` : "Please keep this reference."}
        </p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/destinations">Browse destinations while you wait</Link>
        </Button>
      </div>
    );
  }

  const err = state.status === "error" ? state.fieldErrors : {};
  const v = state.status === "error" ? state.values : {};

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {state.status === "error" && (
        <FormAlert tone="error" title={state.message}>
          {state.slotTaken && (
            <Link href={`/consultations/${serviceSlug}`} className="underline underline-offset-4">
              See available times
            </Link>
          )}
        </FormAlert>
      )}
      <input type="hidden" name="serviceSlug" value={serviceSlug} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <input type="hidden" name="timezone" defaultValue={businessTz} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">How would you like to meet?</legend>
        <div className="flex flex-wrap gap-3">
          {formats.map((f) => (
            <label
              key={f}
              className="flex min-h-11 items-center gap-2 rounded-md border bg-white px-4 text-sm has-[:checked]:border-navy-900 has-[:checked]:bg-navy-100/50"
            >
              <input
                type="radio"
                name="format"
                value={f}
                defaultChecked={(v.format || formats[0]) === f}
                className="accent-navy-900"
              />
              {FORMAT_LABELS[f]}
            </label>
          ))}
        </div>
        {err.format && <p className="text-sm text-status-danger">{err.format}</p>}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <F label="Full name" name="name" error={err.name}>
          {(p) => <input {...p} defaultValue={v.name} autoComplete="name" className={control} />}
        </F>
        <F label="Email" name="email" error={err.email}>
          {(p) => <input {...p} type="email" defaultValue={v.email} autoComplete="email" className={control} />}
        </F>
        <F label="Phone (needed for phone calls)" name="phone" error={err.phone}>
          {(p) => <input {...p} type="tel" defaultValue={v.phone} autoComplete="tel" className={control} />}
        </F>
      </div>
      <F label="Anything we should know? (optional)" name="notes" error={err.notes}>
        {(p) => <textarea {...p} rows={4} defaultValue={v.notes} className={cn(control, "h-auto py-2")} />}
      </F>
      <p className="text-xs text-muted-foreground">
        Please don’t include passport numbers or payment details. We use these details only to arrange your
        consultation.
      </p>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}

function F({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: (p: { id: string; name: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id}-err` : undefined,
      })}
      {error && (
        <p id={`${id}-err`} className="text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}
