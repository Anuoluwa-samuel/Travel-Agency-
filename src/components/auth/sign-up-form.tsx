"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/validation/auth";

type Values = { name: string; email: string; password: string; confirmPassword: string };

export function SignUpForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "/account",
    });
    if (error && error.status === 429) {
      setError("Too many attempts. Please wait a minute and try again.");
      return;
    }
    if (error && error.status !== 422) {
      setError("We couldn't create your account. Please check your details and try again.");
      return;
    }
    // 422 = email already registered. Show the same confirmation so the form can't be used
    // to discover who has an account.
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <FormAlert tone="success" title="Check your inbox">
        If <strong>{sentTo}</strong> can be used for a new account, we’ve sent a link to confirm it. The link expires in
        24 hours.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && <FormAlert tone="error" title={error} />}
      <TextField control={form.control} name="name" label="Full name" autoComplete="name" />
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
      />
      <TextField
        control={form.control}
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        description="At least 10 characters."
      />
      <TextField
        control={form.control}
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
      />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
