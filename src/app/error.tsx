"use client";

import { ErrorState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="container-page py-16">
      <ErrorState
        reference={error.digest}
        action={
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
