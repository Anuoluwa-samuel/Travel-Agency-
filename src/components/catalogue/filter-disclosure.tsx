"use client";

import { useEffect, useRef } from "react";

/**
 * Filters render open (so they work without JavaScript and on desktop). On small screens with
 * no active filters, collapse after mount so results aren't pushed below the fold.
 */
export function FilterDisclosure({
  activeCount,
  className,
  children,
}: {
  activeCount: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (activeCount === 0 && ref.current && window.matchMedia("(max-width: 767px)").matches) ref.current.open = false;
  }, [activeCount]);
  return (
    <details ref={ref} className={className} open>
      {children}
    </details>
  );
}
