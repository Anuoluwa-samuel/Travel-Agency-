import { ArrowRight, Compass, FileCheck2, Plane, Search, Users } from "lucide-react";
import Link from "next/link";
import { CompassMark } from "@/components/brand/logo";
import { DestinationCard } from "@/components/catalogue/destination-card";
import { PackageCard } from "@/components/catalogue/package-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { siteUrl } from "@/config/site";
import { getCollections, getFeaturedDestinations, getFeaturedPackages } from "@/server/services/catalogue/queries";

/*
 * Homepage. Content comes from the published catalogue; nothing here claims reviews, awards,
 * customer counts or partnerships we can't back up (PRD §8).
 */

const services = [
  {
    icon: Plane,
    title: "Flights, hotels and packages",
    body: "International and domestic trips, from a weekend in Accra to two weeks across Southern Africa.",
    href: "/packages",
  },
  {
    icon: Compass,
    title: "Itineraries built around you",
    body: "Tell us how you like to travel. A consultant shapes the plan and confirms every detail with suppliers.",
    href: "/contact?category=custom_trip",
  },
  {
    icon: Users,
    title: "Group trips without the spreadsheet",
    body: "Friends, family or a company retreat: one plan, one point of contact, clear costs per person.",
    href: "/contact?category=group",
  },
  {
    icon: FileCheck2,
    title: "Visa document preparation",
    body: "Clear checklists and help preparing your documents. Decisions always rest with the embassy.",
    href: "/contact?category=visa",
  },
];

export default async function HomePage() {
  const [destinations, packages, collections] = await Promise.all([
    getFeaturedDestinations(6),
    getFeaturedPackages(3),
    getCollections(),
  ]);

  return (
    <>
      <section className="surface-dark relative overflow-hidden bg-navy-900 text-cloud-50">
        <CompassMark className="pointer-events-none absolute -top-32 -right-40 size-[26rem] text-navy-700 opacity-[0.14] md:-right-24 md:size-[40rem]" />
        <div className="container-page relative flex flex-col gap-10 py-20 md:py-28">
          <div className="flex max-w-3xl flex-col gap-6">
            <p className="eyebrow">Travel, arranged properly</p>
            <span className="gold-rule" aria-hidden="true" />
            <h1 className="text-4xl leading-[1.05] font-normal text-cloud-50 md:text-6xl">
              Go further, with every detail <em className="text-gold-500 not-italic">taken care of.</em>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-navy-100">{brand.description}</p>
          </div>
          <form action="/destinations" method="get" role="search" className="flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label htmlFor="home-q" className="sr-only">
              Search destinations
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-navy-500"
                aria-hidden="true"
              />
              <input
                id="home-q"
                name="q"
                type="search"
                placeholder="Where would you like to go?"
                className="h-12 w-full rounded-md border-0 bg-white pr-4 pl-12 text-base text-ink"
                maxLength={80}
              />
            </div>
            <Button type="submit" variant="accent" size="lg">
              Explore
            </Button>
          </form>
          <p className="text-sm text-navy-300">
            Or{" "}
            <Link href="/contact?category=custom_trip" className="text-gold-500 underline underline-offset-4">
              tell us what you have in mind
            </Link>{" "}
            and a consultant will suggest options.
          </p>
        </div>
      </section>

      {destinations.length > 0 && (
        <section className="container-page py-20 md:py-24" aria-labelledby="dest-heading">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <p className="eyebrow">Destinations</p>
              <h2 id="dest-heading" className="text-3xl md:text-4xl">
                Places we know well
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/destinations">
                All destinations <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d) => (
              <li key={d.slug}>
                <DestinationCard d={d} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {collections.length > 0 && (
        <section className="border-y bg-white" aria-labelledby="col-heading">
          <div className="container-page grid gap-8 py-16 md:grid-cols-[1fr_2fr] md:items-center">
            <div className="flex flex-col gap-3">
              <p className="eyebrow">Collections</p>
              <h2 id="col-heading" className="text-3xl">
                Start from an idea
              </h2>
            </div>
            <ul className="flex flex-wrap gap-3">
              {collections.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/destinations?category=${c.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:border-navy-900"
                  >
                    {c.name}
                    <span className="tabular text-xs text-muted-foreground">{c.destinations}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {packages.length > 0 && (
        <section className="container-page py-20 md:py-24" aria-labelledby="pkg-heading">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <p className="eyebrow">Packages</p>
              <h2 id="pkg-heading" className="text-3xl md:text-4xl">
                Ready-made itineraries
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/packages">
                All packages <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <li key={p.slug} className="flex">
                <PackageCard p={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface-dark bg-navy-950 text-navy-100" aria-labelledby="services-heading">
        <div className="container-page py-20 md:py-24">
          <div className="mb-12 flex max-w-2xl flex-col gap-3">
            <p className="eyebrow">What we do</p>
            <h2 id="services-heading" className="text-3xl text-cloud-50 md:text-4xl">
              One team for the whole journey
            </h2>
          </div>
          <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {services.map(({ icon: Icon, title, body, href }) => (
              <li key={title} className="flex gap-5 border-t border-navy-800 pt-6">
                <Icon className="mt-1 size-6 shrink-0 text-gold-500" aria-hidden="true" />
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl text-cloud-50">
                    <Link href={href} className="hover:text-gold-300">
                      {title}
                    </Link>
                  </h3>
                  <p className="leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TravelAgency",
          name: brand.name,
          description: brand.description,
          url: siteUrl,
          ...(brand.contact.email ? { email: brand.contact.email } : {}),
          ...(brand.contact.phone ? { telephone: brand.contact.phone } : {}),
        }}
      />
    </>
  );
}
