"use client";

import { useActionState } from "react";
import { cancelAction, payAction, type ActionState } from "@/app/(public)/bookings/[ref]/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";

export function PayForm({
  reference,
  nextLabel,
  nextAmount,
  fullAmount,
  showFull,
  simulated,
}: {
  reference: string;
  nextLabel: string;
  nextAmount: string;
  fullAmount: string;
  showFull: boolean;
  simulated: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(payAction.bind(null, reference), {
    error: null,
  });
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <FormAlert tone="error" title={state.error} />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="choice" value="next" size="lg" disabled={pending}>
          {pending ? "Opening checkout…" : `Pay ${nextLabel.toLowerCase()} · ${nextAmount}`}
        </Button>
        {showFull && (
          <Button type="submit" name="choice" value="full" variant="outline" size="lg" disabled={pending}>
            Pay full balance · {fullAmount}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {simulated
          ? "Development mode: payments use a simulated checkout and no money moves."
          : "You'll pay on Paystack's secure checkout. We never see or store your card details."}
      </p>
    </form>
  );
}

export function CancelForm({ reference, summary }: { reference: string; summary: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(cancelAction.bind(null, reference), {
    error: null,
  });
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <FormAlert tone="error" title={state.error} />}
      <p className="text-sm">{summary}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Why are you cancelling?
        <textarea
          name="reason"
          rows={3}
          required
          className="rounded-md border border-input bg-white px-3 py-2 text-base font-normal md:text-sm"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-navy-900" />I understand the cancellation
        charges shown above.
      </label>
      <Button type="submit" variant="destructive" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Request cancellation"}
      </Button>
    </form>
  );
}
