"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/validation/auth";

type Values = { password: string; confirmPassword: string };

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [state, setState] = useState<"idle" | "done" | "invalid">(linkError || !token ? "invalid" : "idle");
  const form = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    const { error } = await authClient.resetPassword({ newPassword: values.password, token: token! });
    setState(error ? "invalid" : "done");
  }

  if (state === "invalid") {
    return (
      <FormAlert tone="error" title="This link has expired or was already used">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Request a new reset link
        </Link>
      </FormAlert>
    );
  }
  if (state === "done") {
    return (
      <FormAlert tone="success" title="Password updated">
        You’ve been signed out on other devices.{" "}
        <Link href="/sign-in" className="underline underline-offset-4">
          Sign in
        </Link>
      </FormAlert>
    );
  }
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <TextField
        control={form.control}
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        description="At least 10 characters."
      />
      <TextField
        control={form.control}
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
      />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
