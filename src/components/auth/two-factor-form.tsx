"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { backupCodeSchema, totpSchema } from "@/lib/validation/auth";

export function TwoFactorForm() {
  const router = useRouter();
  const next = safeRedirectPath(useSearchParams().get("next"));
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [error, setError] = useState<string | null>(null);

  const totp = useForm<{ code: string; trustDevice: boolean }>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: "", trustDevice: false },
  });
  const backup = useForm<{ code: string }>({ resolver: zodResolver(backupCodeSchema), defaultValues: { code: "" } });

  function done() {
    router.replace(next);
    router.refresh();
  }

  async function onTotp(v: { code: string; trustDevice: boolean }) {
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: v.code, trustDevice: v.trustDevice });
    if (error)
      return setError(
        error.status === 429
          ? "Too many attempts. Please wait a minute."
          : "That code didn't work. Codes change every 30 seconds.",
      );
    done();
  }

  async function onBackup(v: { code: string }) {
    setError(null);
    const { error } = await authClient.twoFactor.verifyBackupCode({ code: v.code });
    if (error) return setError("That backup code isn't valid or was already used.");
    done();
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <FormAlert tone="error" title={error} />}
      {mode === "totp" ? (
        <form onSubmit={totp.handleSubmit(onTotp)} noValidate className="flex flex-col gap-5">
          <TextField
            control={totp.control}
            name="code"
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />
          <Controller
            control={totp.control}
            name="trustDevice"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox id="trust" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                <FieldLabel htmlFor="trust" className="font-normal">
                  Trust this device for 30 days
                </FieldLabel>
              </Field>
            )}
          />
          <Button type="submit" disabled={totp.formState.isSubmitting}>
            Verify
          </Button>
        </form>
      ) : (
        <form onSubmit={backup.handleSubmit(onBackup)} noValidate className="flex flex-col gap-5">
          <TextField control={backup.control} name="code" label="Backup code" autoComplete="off" autoFocus />
          <Button type="submit" disabled={backup.formState.isSubmitting}>
            Use backup code
          </Button>
        </form>
      )}
      <Button variant="link" className="self-start px-0" onClick={() => setMode(mode === "totp" ? "backup" : "totp")}>
        {mode === "totp" ? "Use a backup code instead" : "Use your authenticator app instead"}
      </Button>
    </div>
  );
}
