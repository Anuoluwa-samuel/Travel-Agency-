import { type NextRequest, NextResponse } from "next/server";
import { getBookingForViewer } from "@/server/services/booking/access";
import { confirmPaymentReturn } from "@/server/services/payments/service";

/**
 * Where the provider sends the customer back. The redirect proves nothing: we ask the provider
 * server-to-server and record only a confirmed charge, then show the booking (ARCHITECTURE §7).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/bookings/[ref]/payment-return">) {
  const { ref } = await params;
  const access = await getBookingForViewer(ref);
  if (!access) return NextResponse.redirect(new URL(`/booking/lookup?ref=${encodeURIComponent(ref)}`, request.url));
  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  const result = /^PY-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(reference)
    ? await confirmPaymentReturn(access.booking.id, reference)
    : { state: "unknown" as const };
  const state = result.state === "unknown" ? "pending" : result.state;
  return NextResponse.redirect(new URL(`/bookings/${access.booking.reference}?payment=${state}`, request.url), 303);
}
