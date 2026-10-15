import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic check only (Next.js Proxy guidance): if there is no session cookie at all, send
 * the visitor to sign-in before rendering. Real authorization happens on the server in
 * `requireUser` / `requireStaff`; a forged cookie gets past this and is rejected there.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request, { cookiePrefix: "orbis" }));
  if (!hasSession) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
