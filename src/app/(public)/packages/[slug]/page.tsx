import { ArrowRight, BedDouble, Check, Clock, Coffee, MapPin, Minus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { DestinationArt } from "@/components/catalogue/destination-art";
import { FaqList } from "@/components/catalogue/faq-list";
import { bookingModeLabel } from "@/components/catalogue/package-card";
import { PriceTag } from "@/components/feedback/price-tag";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteUrl } from "@/config/site";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { findSlugRedirect, staticSlugParams, getPackage, getPublishedSlugs } from "@/server/services/catalogue/queries";

export async function generateStaticParams() {
  const { packages } = await getPublishedSlugs();
  return staticSlugParams(packages);
}

export async function generateMetadata({ params }: PageProps<"/packages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPackage(slug);
  if (!p) return { title: "Package not found", robots: { index: false } };
  const title = p.seoTitle ?? p.title;
  const description = p.seoDescription ?? p.summary;
  return {
    title,
    description,
    alternates: { canonical: `/packages/${p.slug}` },
    openGraph: { title, description, url: `/packages/${p.slug}`, type: "article" },
  };
}

export default function PackagePage(props: PageProps<"/packages/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-[60vh]" />}>
      <PackageDetail params={props.params} />
    </Suspense>
  );
}

const itemKindLabel = {
  activity: "Activity",
  transfer: "Transfer",
  flight: "Flight",
  accommodation: "Stay",
  meal: "Meal",
  free_time: "Free time",
} as const;

async function PackageDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPackage(slug);
  if (!p) {
    const target = await findSlugRedirect("package", slug);
    if (target) permanentRedirect(`/packages/${target}`);
    notFound();
  }

  const enquireHref = `/contact?category=package&package=${p.slug}`;

  return (
    <article>
      <DestinationArt name={p.title} label={`${p.destinationName}, ${p.countryName}`} size="lg" />
      <div className="container-page grid gap-12 py-10 md:py-14 lg:grid-cols-[1fr_360px] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-12">
          <div className="flex flex-col gap-5">
            <Breadcrumbs
              baseUrl={siteUrl}
              items={[
                { label: "Home", href: "/" },
                { label: "Packages", href: "/packages" },
                { label: p.title, href: `/packages/${p.slug}` },
              ]}
            />
            <h1 className="sr-only">{p.title}</h1>
            <p className="font-heading text-2xl leading-snug text-navy-900 md:text-3xl">{p.summary}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-800">
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-gold-700" aria-hidden="true" /> {p.durationDays} days, {p.nights} nights
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-gold-700" aria-hidden="true" />
                {p.destinations.length > 0 ? p.destinations.map((d) => d.name).join(" · ") : p.destinationName}
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4 text-gold-700" aria-hidden="true" /> {p.minPax}–{p.maxPax} travellers
              </li>
            </ul>
            {p.description && <p className="max-w-prose text-lg leading-relaxed text-ink">{p.description}</p>}
          </div>

          <section aria-labelledby="itinerary" className="flex flex-col gap-6">
            <h2 id="itinerary" className="text-2xl">
              Day by day
            </h2>
            <ol className="relative flex flex-col gap-8 border-l border-navy-100 pl-8">
              {p.days.map((day) => {
                const meals = [day.breakfast && "Breakfast", day.lunch && "Lunch", day.dinner && "Dinner"].filter(
                  Boolean,
                );
                return (
                  <li key={day.id} className="relative">
                    <span
                      className="absolute -left-[3.05rem] flex size-9 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-gold-500"
                      aria-hidden="true"
                    >
                      {day.dayNumber}
                    </span>
                    <h3 className="text-lg">
                      <span className="sr-only">Day {day.dayNumber}: </span>
                      {day.title}
                    </h3>
                    {day.description && <p className="mt-1 leading-relaxed text-muted-foreground">{day.description}</p>}
                    {day.items.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                        {day.items.map((it, i) => (
                          <li key={i} className="flex items-baseline gap-2">
                            <span className="w-20 shrink-0 text-xs text-muted-foreground uppercase">
                              {itemKindLabel[it.kind]}
                            </span>
                            <span>
                              {it.title}
                              {it.isOptional && <span className="text-gold-700"> · optional extra</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {day.overnightLocation && (
                        <span className="flex items-center gap-1">
                          <BedDouble className="size-3.5" aria-hidden="true" /> {day.overnightLocation}
                        </span>
                      )}
                      {meals.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Coffee className="size-3.5" aria-hidden="true" /> {meals.join(", ")}
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="inclusions" className="grid gap-8 md:grid-cols-2">
            <h2 id="inclusions" className="sr-only">
              What’s included
            </h2>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl">Included</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {p.included.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-status-confirmed" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl">Not included</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {p.excluded.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {p.stays.length > 0 && (
            <section aria-labelledby="stays" className="flex flex-col gap-4">
              <h2 id="stays" className="text-2xl">
                Where you’ll stay
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {p.stays.map((s) => (
                  <li key={s.id} className="rounded-lg border bg-white p-5">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[s.location, `${s.nights} nights`, s.mealPlan].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="dates" className="flex flex-col gap-4">
            <h2 id="dates" className="text-2xl">
              Dates and prices
            </h2>
            {p.departures.length === 0 ? (
              <p className="text-muted-foreground">
                No fixed departures are open right now. We can arrange this trip on dates that suit you.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Upcoming departures with per-person prices</caption>
                  <thead className="bg-cloud-100 text-left">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Dates
                      </th>
                      {p.rooms.map((r) => (
                        <th key={r.id} scope="col" className="px-4 py-3 font-medium">
                          {r.name}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.departures.map((d) => (
                      <tr key={d.id} className="border-t">
                        <th scope="row" className="px-4 py-3 text-left font-normal">
                          {formatDate(d.startDate, { year: undefined })} – {formatDate(d.endDate)}
                          {d.bookingDeadline && (
                            <span className="block text-xs text-muted-foreground">
                              Book by {formatDate(d.bookingDeadline)}
                            </span>
                          )}
                        </th>
                        {p.rooms.map((r) => {
                          const price = d.prices[r.id];
                          return (
                            <td key={r.id} className="tabular px-4 py-3">
                              {price ? formatMoney(price) : "On request"}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3">
                          {d.availability === "closed" ? (
                            <StatusBadge tone="danger">Closed</StatusBadge>
                          ) : d.availability === "limited" ? (
                            <StatusBadge tone="pending">Few places left</StatusBadge>
                          ) : (
                            <StatusBadge tone="info">Available</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Prices are per person in the room type shown. Availability shown here is ORBIS’s own allocation and is
              confirmed with suppliers before you pay.
            </p>
            {p.addons.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-lg">Optional extras</h3>
                <ul className="flex flex-col divide-y rounded-lg border bg-white text-sm">
                  {p.addons.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span>{a.name}</span>
                      <span className="tabular">{a.price ? `${formatMoney(a.price)} per person` : "On request"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {(p.paymentPlan || p.cancellationPolicy) && (
            <section aria-labelledby="terms" className="flex flex-col gap-4">
              <h2 id="terms" className="text-2xl">
                Payment and cancellation
              </h2>
              {p.paymentPlan && (
                <p className="max-w-prose leading-relaxed">
                  A deposit of {p.paymentPlan.depositBasisPoints / 100}% secures your place once availability is
                  confirmed. The balance is due {p.paymentPlan.balanceDueDaysBefore} days before departure.
                </p>
              )}
              {p.cancellationPolicy && (
                <details className="rounded-lg border bg-white p-5">
                  <summary className="cursor-pointer font-medium">{p.cancellationPolicy.title}</summary>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                    {p.cancellationPolicy.body}
                  </p>
                </details>
              )}
            </section>
          )}

          <FaqList faqs={p.faqs} />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-5 rounded-lg border bg-white p-6">
            {p.fromPrice ? (
              <PriceTag value={p.fromPrice} source="package" basis="from, per person" size="lg" />
            ) : (
              <p className="font-heading text-2xl">Price on request</p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {p.bookingMode === "instant"
                ? "Secure online booking for this package is coming soon. Send a request and we'll hold your place while we confirm."
                : "Send a request with your dates and travellers. We confirm availability and the final price with our partners before you pay anything."}
            </p>
            <Button asChild size="lg">
              <Link href={enquireHref}>
                {bookingModeLabel[p.bookingMode === "instant" ? "request" : p.bookingMode]}{" "}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              A request is not a confirmed booking. You’ll get a reference number straight away.
            </p>
          </div>
          <Link
            href={`/destinations/${p.destinationSlug}`}
            className="text-sm text-navy-700 underline-offset-4 hover:underline"
          >
            More about {p.destinationName}
          </Link>
        </aside>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: p.title,
          description: p.summary,
          url: `${siteUrl}/packages/${p.slug}`,
          itinerary: {
            "@type": "ItemList",
            itemListElement: p.days.map((d) => ({ "@type": "ListItem", position: d.dayNumber, name: d.title })),
          },
        }}
      />
    </article>
  );
}
