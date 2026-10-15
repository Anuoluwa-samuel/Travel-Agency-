import type { Metadata } from "next";
import { ServiceFallback } from "@/components/enquiry/service-fallback";

export const metadata: Metadata = {
  title: "Hotels",
  description:
    "Hotels and stays arranged by an ORBIS consultant, with room, meal plan and cancellation terms made clear.",
  alternates: { canonical: "/hotels" },
};

export default function HotelsPage() {
  return (
    <ServiceFallback
      title="Hotels"
      path="/hotels"
      category="hotel"
      intro="Hotels, resorts and apartments, from a city weekend to a family beach holiday."
      points={[
        "Share your destination, dates, room needs and budget.",
        "We compare options and point out refundable versus non-refundable rates.",
        "Your stay is confirmed only after the hotel accepts the booking.",
      ]}
    />
  );
}
