"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ResendVerification() {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: { email: string }) {
    await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
    setSent(true);
  }

  if (sent) {
    return <FormAlert tone="success" title="If that account needs confirming, a new link is on its way." />;
  }
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
      <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
        Send a new link
      </Button>
    </form>
  );
}
