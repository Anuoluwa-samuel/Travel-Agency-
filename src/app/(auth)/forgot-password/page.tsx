import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter your email and we'll send you a link to choose a new password."
      />
      <ForgotPasswordForm />
      <Link href="/sign-in" className="mt-6 text-sm text-navy-700 underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </>
  );
}
