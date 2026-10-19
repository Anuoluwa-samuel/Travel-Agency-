"use client";

import { useSyncExternalStore } from "react";
import { formatInZone } from "@/lib/zoned-time";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The visitor's timezone; the server snapshot is the business timezone so hydration matches. */
export function useVisitorTimeZone(fallback: string) {
  return useSyncExternalStore(subscribe, browserZone, () => fallback);
}

/** "(3:00 pm your time)" when the visitor isn't in the business timezone. */
export function LocalTimeHint({ iso, businessTz }: { iso: string; businessTz: string }) {
  const tz = useVisitorTimeZone(businessTz);
  if (tz === businessTz) return null;
  const sameOffset =
    formatInZone(iso, tz, { hour: "2-digit", minute: "2-digit" }) ===
    formatInZone(iso, businessTz, { hour: "2-digit", minute: "2-digit" });
  if (sameOffset) return null;
  return (
    <span className="block text-xs text-muted-foreground">
      {formatInZone(iso, tz, { weekday: "short", hour: "2-digit", minute: "2-digit" })} your time
    </span>
  );
}
