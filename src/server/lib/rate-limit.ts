import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rateLimitBuckets } from "@/server/db/schema";

/**
 * Fixed-window rate limiter on Postgres (ADR-003: no Redis in v1). One atomic upsert per check.
 * Keys must never contain raw personal data: hash emails and IPs before passing them in.
 */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });
  return { allowed: row.count <= limit, count: row.count, resetAt: new Date(windowStart.getTime() + windowMs) };
}
