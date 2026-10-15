"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { signInSchema } from "@/lib/validation/auth";

type Values = { email: string; password: string };

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"));
  const [error, setError] = useState<{ title: string; body?: string } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: Values) {
    setError(null);
    const { data, error } = await authClient.signIn.email({ email: values.email, password: values.password });
    if (error) {
      if (error.status === 403) {
        setError({
          title: "Please confirm your email first",
          body: "We've sent a new confirmation link to your inbox.",
        });
      } else if (error.status === 429) {
        setError({ title: "Too many attempts", body: "Please wait a minute before trying again." });
      } else {
        // Same message for unknown email and wrong password: no account enumeration.
        setError({ title: "Email or password is incorrect" });
      }
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/two-factor?next=${encodeURIComponent(next)}`);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && (
        <FormAlert tone="error" title={error.title}>
          {error.body}
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
      <TextField
        control={form.control}
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
      />
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm text-navy-700 underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
