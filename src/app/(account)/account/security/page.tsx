import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { TwoFactorSetup } from "@/components/account/two-factor-setup";
import { FormAlert } from "@/components/forms/form-alert";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign-in & security", robots: { index: false } };

export default async function SecurityPage({ searchParams }: PageProps<"/account/security">) {
  const user = await requireUser();
  const required = (await searchParams).required === "2fa";
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Account</p>
        <h1 className="text-3xl">Sign-in & security</h1>
      </div>

      <section aria-labelledby="tfa" className="flex flex-col gap-4">
        <h2 id="tfa" className="text-xl">
          Two-factor authentication
        </h2>
        {required && !user.twoFactorEnabled && (
          <FormAlert tone="error" title="Two-factor is required for your staff role">
            Turn it on below to open the ORBIS admin workspace.
          </FormAlert>
        )}
        <p className="max-w-prose text-sm text-muted-foreground">
          Use an authenticator app such as Google Authenticator, 1Password or Authy. You’ll enter a code from the app
          when you sign in on a new device.
        </p>
        <TwoFactorSetup enabled={user.twoFactorEnabled} />
      </section>

      <section aria-labelledby="pw" className="flex flex-col gap-4 border-t pt-10">
        <h2 id="pw" className="text-xl">
          Password
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
