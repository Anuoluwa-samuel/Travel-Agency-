import type { Metadata } from "next";
import { ServiceFallback } from "@/components/enquiry/service-fallback";

export const metadata: Metadata = {
  title: "Flights",
  description:
    "International and domestic flights arranged by an ORBIS consultant, with fare rules explained before you pay.",
  alternates: { canonical: "/flights" },
};

export default function FlightsPage() {
  return (
    <ServiceFallback
      title="Flights"
      path="/flights"
      category="flight"
      intro="International and domestic flights, including multi-city routes and group fares."
      points={[
        "Tell us your route, dates, number of travellers and preferred cabin.",
        "We explain baggage allowances and change or refund rules before you decide.",
        "Tickets are issued only after you approve the fare and payment is confirmed.",
      ]}
    />
  );
}
