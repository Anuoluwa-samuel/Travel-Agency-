"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "cn";

export function SignOutButton({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className={cn(
        "justify-start",
        tone === "light" && "text-navy-100 hover:bg-navy-800 hover:text-cloud-50",
        className,
      )}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.replace("/sign-in");
          router.refresh();
        })
      }
    >
      <LogOut data-icon="inline-start" /> {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
