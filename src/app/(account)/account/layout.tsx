import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SideNavLink } from "@/components/layout/side-nav-link";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/auth/session";

/*
 * Customer workspace shell. Only the sections that exist are listed (journeys.md §2); the rest
 * appear as their phases ship. The session check runs inside Suspense (Cache Components).
 */
const sections = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/security", label: "Sign-in & security", icon: ShieldCheck },
];

/**
 * Session and permission checks run fresh on every navigation (no `use cache: private`), so a
 * revoked session or removed staff role takes effect immediately. That's a deliberate trade
 * against instant navigation for authenticated areas.
 */
export const instant = false;

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <SignOutButton />
        </div>
      </header>
      <div className="container-page grid flex-1 gap-8 py-8 md:grid-cols-[220px_1fr]">
        <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:flex-col">
          {sections.map(({ href, label, icon: Icon, exact }) => (
            <SideNavLink key={href} href={href} exact={exact}>
              <Icon aria-hidden="true" /> {label}
            </SideNavLink>
          ))}
        </nav>
        <main id="main" className="min-w-0">
          <Suspense fallback={<AccountSkeleton />}>
            <RequireCustomer>{children}</RequireCustomer>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function RequireCustomer({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account");
  return <>{children}</>;
}

function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
