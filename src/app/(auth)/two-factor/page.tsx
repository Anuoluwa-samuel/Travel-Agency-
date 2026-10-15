import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata: Metadata = { title: "Two-factor verification", robots: { index: false } };

export default function TwoFactorPage() {
  return (
    <>
      <AuthHeading title="Two-factor verification" description="Enter the 6-digit code from your authenticator app." />
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </>
  );
}
