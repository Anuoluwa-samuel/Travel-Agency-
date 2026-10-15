import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { isGroup, liveOnly, primaryNav } from "@/config/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { MobileNav } from "./mobile-nav";

export function SiteHeader() {
  const nav = liveOnly(primaryNav);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-cloud-50/95 backdrop-blur supports-[backdrop-filter]:bg-cloud-50/80">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {nav.map((item) =>
            isGroup(item) ? null : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-navy-800 hover:bg-cloud-100 hover:text-navy-900"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Suspense fallback={<div className="h-11 w-24" aria-hidden="true" />}>
            <AccountAction />
          </Suspense>
          <MobileNav nav={nav} />
        </div>
      </div>
    </header>
  );
}

/** Reads the session, so it streams in behind the Suspense boundary above. */
async function AccountAction() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Button asChild variant="outline">
        <Link href="/account">My trips</Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost">
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}
