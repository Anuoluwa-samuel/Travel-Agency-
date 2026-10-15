import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/server/env";

/** Keyed hash for rate-limit keys and abuse signals, so raw IPs and emails are never stored. */
export function privacyHash(value: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** Best-effort client IP. Only trustworthy behind a proxy that sets x-forwarded-for. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
