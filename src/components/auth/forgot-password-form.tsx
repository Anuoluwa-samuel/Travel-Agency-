"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: { email: string }) {
    setRateLimited(false);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    if (error?.status === 429) {
      setRateLimited(true);
      return;
    }
    // Same outcome whether or not the account exists.
    setDone(true);
  }

  if (done) {
    return (
      <FormAlert tone="success" title="Check your inbox">
        If an account uses that email, we’ve sent a link to reset the password. It expires in 1 hour.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {rateLimited && (
        <FormAlert tone="error" title="Too many requests">
          Please wait a minute and try again.
        </FormAlert>
      )}
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
      />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
