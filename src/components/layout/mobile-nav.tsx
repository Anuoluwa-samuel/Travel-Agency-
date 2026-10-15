"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type NavGroup, type NavItem, isGroup } from "@/config/navigation";

export function MobileNav({ nav }: { nav: (NavItem | NavGroup)[] }) {
  const [open, setOpen] = useState(false);
  if (nav.length === 0) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[86vw] max-w-sm">
        <SheetHeader>
          <SheetTitle asChild>
            <div>
              <Logo />
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-6 px-4 pb-8">
          {nav.map((item) =>
            isGroup(item) ? (
              <div key={item.label}>
                <p className="eyebrow mb-2">{item.label}</p>
                <ul className="flex flex-col">
                  {item.items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} onClick={() => setOpen(false)} className="block min-h-11 py-2.5 text-base">
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="min-h-11 py-2.5 text-lg">
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
