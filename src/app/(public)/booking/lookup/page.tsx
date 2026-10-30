import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LookupForm } from "@/components/booking/lookup-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Find your booking", robots: { index: false, follow: false } };

export default function LookupPage(props: PageProps<"/booking/lookup">) {
  return (
    <div className="container-page flex max-w-lg flex-col gap-6 py-14">
      <h1 className="text-3xl">Find your booking</h1>
      <p className="text-muted-foreground">
        For your security we email a one-time code to the address on the booking. Have an account?{" "}
        <Link href="/sign-in?next=/account/bookings" className="underline underline-offset-4">
          Sign in instead
        </Link>
        .
      </p>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <LookupForm initialReference={typeof sp.ref === "string" ? sp.ref.slice(0, 20) : ""} />;
}
