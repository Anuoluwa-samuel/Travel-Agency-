import { ArrowRight, Compass, FileCheck2, Plane, Users } from "lucide-react";
import Link from "next/link";
import { CompassMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

/*
 * Phase 2 homepage: brand, services and a working call to action. Destination and package
 * content arrives with the catalogue in Phase 3; nothing here claims reviews, awards or
 * numbers we can't back up.
 */

const services = [
  {
    icon: Plane,
    title: "Flights, hotels and packages",
    body: "International and domestic trips, from a weekend in Accra to two weeks across Southern Africa.",
  },
  {
    icon: Compass,
    title: "Itineraries built around you",
    body: "Tell us how you like to travel. A consultant shapes the plan and confirms every detail with suppliers.",
  },
  {
    icon: Users,
    title: "Group trips without the spreadsheet",
    body: "Invite friends or family, vote on destinations and see who has paid, all in one place.",
  },
  {
    icon: FileCheck2,
    title: "Visa document preparation",
    body: "Clear checklists and secure document upload. We help you prepare; decisions rest with the embassy.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="surface-dark relative overflow-hidden bg-navy-900 text-cloud-50">
        <CompassMark className="pointer-events-none absolute -top-32 -right-40 size-[26rem] text-navy-700 opacity-[0.14] md:-right-24 md:size-[40rem]" />
        <div className="container-page relative grid gap-10 py-20 md:py-32">
          <div className="flex max-w-3xl flex-col gap-6">
            <p className="eyebrow">Travel, arranged properly</p>
            <span className="gold-rule" aria-hidden="true" />
            <h1 className="text-4xl leading-[1.05] font-normal text-cloud-50 md:text-6xl">
              Go further, with every detail <em className="text-gold-500 not-italic">taken care of.</em>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-navy-100">{brand.description}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="accent" size="lg">
                <Link href="/sign-up">
                  Create your account <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="border border-navy-700 bg-transparent text-cloud-50 hover:bg-navy-800"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-20 md:py-28" aria-labelledby="services-heading">
        <div className="mb-12 flex max-w-2xl flex-col gap-3">
          <p className="eyebrow">What we do</p>
          <h2 id="services-heading" className="text-3xl md:text-4xl">
            One team for the whole journey
          </h2>
        </div>
        <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {services.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-5 border-t pt-6">
              <Icon className="mt-1 size-6 shrink-0 text-gold-600" aria-hidden="true" />
              <div className="flex flex-col gap-2">
                <h3 className="text-xl">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
