"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function SideNavLink({
  href,
  children,
  tone = "dark",
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "dark" | "light";
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium [&_svg]:size-4",
        tone === "dark" && (active ? "bg-navy-100 text-navy-900" : "text-navy-800 hover:bg-cloud-100"),
        tone === "light" &&
          (active
            ? "bg-navy-800 text-cloud-50 shadow-[inset_2px_0_0_var(--color-gold-500)]"
            : "text-navy-100 hover:bg-navy-800 hover:text-cloud-50"),
      )}
    >
      {children}
    </Link>
  );
}
