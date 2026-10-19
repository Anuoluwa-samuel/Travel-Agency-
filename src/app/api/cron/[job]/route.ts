import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { releaseExpiredHolds } from "@/server/services/booking/expiry";

/**
 * Scheduled jobs, called by the host's scheduler with `Authorization: Bearer $CRON_SECRET`.
 * Until pg-boss lands (Phase 5) this is how periodic work runs.
 */
const JOBS: Record<string, () => Promise<unknown>> = {
  "release-holds": () => releaseExpiredHolds(),
};

function authorized(request: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(request: Request, { params }: RouteContext<"/api/cron/[job]">) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return new Response(null, { status: 404 });
  const result = await run();
  return Response.json(result, { status: 200 });
}
