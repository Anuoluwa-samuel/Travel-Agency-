import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SideNavLink } from "@/components/layout/side-nav-link";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleAdminNav } from "@/config/admin-nav";
import { TwoFactorRequiredError, requireStaff } from "@/server/auth/session";
import { isAppError } from "@/server/lib/errors";

/**
 * Session and permission checks run fresh on every navigation (no `use cache: private`), so a
 * revoked session or removed staff role takes effect immediately. That's a deliberate trade
 * against instant navigation for authenticated areas.
 */
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · ORBIS Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

/**
 * Staff gate. Customers and signed-out visitors get a 404 so the admin area isn't advertised;
 * privileged staff without 2FA are sent to enable it. Each admin page still re-checks its own
 * permission on the server.
 */
async function AdminShell({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireStaff();
  } catch (e) {
    if (e instanceof TwoFactorRequiredError) redirect("/account/security?required=2fa");
    if (isAppError(e) && e.code === "UNAUTHENTICATED") redirect("/sign-in?next=/admin");
    if (isAppError(e)) notFound();
    throw e;
  }
  const nav = visibleAdminNav(ctx.permissions);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="surface-dark flex shrink-0 flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-64">
        <div className="flex items-center justify-between gap-2 px-2 pt-2">
          <Logo tone="light" href="/admin" />
          <span className="eyebrow text-[0.65rem]">Admin</span>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {nav.map((g) => (
            <div key={g.group} className="flex flex-col gap-1">
              <p className="px-3 text-[0.7rem] font-semibold tracking-[0.14em] text-navy-300 uppercase">{g.group}</p>
              {g.items.map((i) => (
                <SideNavLink key={i.href} href={i.href} tone="light" exact={i.href === "/admin"}>
                  {i.label}
                </SideNavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-2 border-t border-navy-800 pt-4">
          <p className="truncate px-3 text-sm" title={ctx.user.email}>
            {ctx.user.name}
          </p>
          <SignOutButton tone="light" />
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 bg-navy-900 md:block" />
      <div className="flex flex-1 flex-col gap-4 p-8">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
