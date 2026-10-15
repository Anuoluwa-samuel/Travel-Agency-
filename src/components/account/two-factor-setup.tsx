"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const passwordOnly = z.object({ password: z.string().min(1, "Enter your current password") });
const codeOnly = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

type Step =
  { kind: "password" } | { kind: "scan"; qr: string; secret: string; backupCodes: string[] } | { kind: "done" };

/**
 * Two-step enrolment: confirm password → scan QR / enter key → confirm a live code.
 * Two-factor is only switched on after a valid code proves the authenticator works.
 */
export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: enabled ? "done" : "password" });
  const [error, setError] = useState<string | null>(null);
  const pw = useForm<{ password: string }>({ resolver: zodResolver(passwordOnly), defaultValues: { password: "" } });
  const code = useForm<{ code: string }>({ resolver: zodResolver(codeOnly), defaultValues: { code: "" } });
  const disablePw = useForm<{ password: string }>({
    resolver: zodResolver(passwordOnly),
    defaultValues: { password: "" },
  });

  async function start({ password }: { password: string }) {
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    if (error || !data) return setError("That password isn't correct.");
    if (data.method !== "totp") return setError("Authenticator setup isn't available. Please contact support.");
    const qr = await QRCode.toDataURL(data.totpURI, {
      margin: 1,
      width: 200,
      color: { dark: "#0B2545", light: "#FFFFFF" },
    });
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setStep({ kind: "scan", qr, secret, backupCodes: data.backupCodes });
  }

  async function confirm({ code: c }: { code: string }) {
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: c });
    if (error) return setError("That code didn't match. Check your device's clock and try the newest code.");
    setStep({ kind: "done" });
    router.refresh();
  }

  async function disable({ password }: { password: string }) {
    setError(null);
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) return setError("That password isn't correct.");
    disablePw.reset();
    setStep({ kind: "password" });
    router.refresh();
  }

  if (step.kind === "done") {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success" title="Two-factor authentication is on" />
        <details className="rounded-md border bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Turn off two-factor</summary>
          <form onSubmit={disablePw.handleSubmit(disable)} noValidate className="mt-4 flex flex-col gap-4">
            {error && <FormAlert tone="error" title={error} />}
            <p className="text-sm text-muted-foreground">
              Staff in privileged roles lose admin access while two-factor is off.
            </p>
            <TextField
              control={disablePw.control}
              name="password"
              label="Current password"
              type="password"
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="destructive"
              disabled={disablePw.formState.isSubmitting}
              className="self-start"
            >
              Turn off
            </Button>
          </form>
        </details>
      </div>
    );
  }

  if (step.kind === "password") {
    return (
      <form onSubmit={pw.handleSubmit(start)} noValidate className="flex max-w-sm flex-col gap-5">
        {error && <FormAlert tone="error" title={error} />}
        <TextField
          control={pw.control}
          name="password"
          label="Current password"
          type="password"
          autoComplete="current-password"
        />
        <Button type="submit" disabled={pw.formState.isSubmitting} className="self-start">
          Set up two-factor
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated locally */}
        <img
          src={step.qr}
          alt="QR code for your authenticator app"
          width={200}
          height={200}
          className="rounded-md border"
        />
        <p className="max-w-[200px] text-xs text-muted-foreground">
          Can’t scan? Enter this key: <code className="font-mono break-all text-navy-900">{step.secret}</code>
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-2 text-lg">Save your backup codes</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Each code works once if you lose your device. Store them somewhere safe.
          </p>
          <ul className="grid grid-cols-2 gap-1 rounded-md bg-cloud-100 p-3 font-mono text-sm">
            {step.backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <form onSubmit={code.handleSubmit(confirm)} noValidate className="flex max-w-sm flex-col gap-5">
          {error && <FormAlert tone="error" title={error} />}
          <TextField
            control={code.control}
            name="code"
            label="Code from your app"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
          />
          <Button type="submit" disabled={code.formState.isSubmitting} className="self-start">
            Confirm and turn on
          </Button>
        </form>
      </div>
    </div>
  );
}
