import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResendVerification } from "@/components/auth/resend-verification";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

/** Landing page for expired or invalid confirmation links. */
export default function VerifyEmailPage() {
  return (
    <>
      <AuthHeading
        title="Confirm your email"
        description="Confirmation links expire after 24 hours and work once. Enter your email to get a new one."
      />
      <ResendVerification />
    </>
  );
}
