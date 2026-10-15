"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { passwordSchema } from "@/lib/validation/auth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [result, setResult] = useState<"ok" | "error" | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(v: Values) {
    const { error } = await authClient.changePassword({
      currentPassword: v.currentPassword,
      newPassword: v.newPassword,
      revokeOtherSessions: true,
    });
    setResult(error ? "error" : "ok");
    if (!error) form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex max-w-sm flex-col gap-5">
      {result === "ok" && (
        <FormAlert tone="success" title="Password changed">
          Other devices have been signed out.
        </FormAlert>
      )}
      {result === "error" && <FormAlert tone="error" title="Your current password isn't correct" />}
      <TextField
        control={form.control}
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
      />
      <TextField
        control={form.control}
        name="newPassword"
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
      <Button type="submit" disabled={form.formState.isSubmitting} className="self-start">
        Change password
      </Button>
    </form>
  );
}
