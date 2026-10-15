import { CalendarCheck2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function AccountOverviewPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Your account</p>
        <h1 className="text-3xl">Hello, {user.name.split(" ")[0]}</h1>
      </div>
      <EmptyState
        icon={CalendarCheck2}
        title="No trips yet"
        description="Bookings, payments and travel documents will appear here once you book or enquire with us."
        action={
          !user.twoFactorEnabled ? (
            <Button asChild variant="outline">
              <Link href="/account/security">Secure your account with two-factor</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
