import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-start justify-center gap-6 py-16">
      <Logo />
      <p className="eyebrow">404</p>
      <h1 className="text-4xl">We couldn’t find that page</h1>
      <p className="max-w-prose text-muted-foreground">The link may be out of date, or the page may have moved.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
