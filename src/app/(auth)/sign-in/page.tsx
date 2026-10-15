import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <>
      <AuthHeading
        title="Welcome back"
        description={
          <>
            New to ORBIS?{" "}
            <Link href="/sign-up" className="font-medium text-navy-700 underline underline-offset-4">
              Create an account
            </Link>
          </>
        }
      />
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}
