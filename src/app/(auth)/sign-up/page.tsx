import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading
        title="Create your account"
        description={
          <>
            Already have one?{" "}
            <Link href="/sign-in" className="font-medium text-navy-700 underline underline-offset-4">
              Sign in
            </Link>
          </>
        }
      />
      <SignUpForm />
    </>
  );
}
