"use client";

import { useActionState } from "react";
import { lookupAction, type LookupState } from "@/app/(public)/booking/lookup/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";

const control = "border-input h-11 w-full rounded-md border bg-white px-3 text-base md:text-sm";

export function LookupForm({ initialReference }: { initialReference: string }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, {
    step: "request",
    reference: initialReference,
    error: null,
  });
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert tone="error" title={state.error} />}
      {state.step === "request" ? (
        <>
          <input type="hidden" name="step" value="request" />
          <label className="flex flex-col gap-2 text-sm font-medium">
            Booking reference
            <input
              name="reference"
              defaultValue={state.reference}
              placeholder="BK-XXXX-XXXX"
              autoComplete="off"
              className={control}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email used for the booking
            <input name="email" type="email" autoComplete="email" className={control} />
          </label>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Sending…" : "Email me a code"}
          </Button>
        </>
      ) : (
        <>
          <FormAlert tone="success" title="Check your email">
            If the reference and email match a booking, we’ve sent a 6-digit code. It expires in 10 minutes.
          </FormAlert>
          <input type="hidden" name="step" value="code" />
          <input type="hidden" name="reference" value={state.reference} />
          <label className="flex flex-col gap-2 text-sm font-medium">
            6-digit code
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={control} />
          </label>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Checking…" : "View booking"}
          </Button>
        </>
      )}
    </form>
  );
}
