import { ArrowRight, CalendarDays, Clock, FileText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { bestMonthsLabel, DestinationCard } from "@/components/catalogue/destination-card";
import { DestinationArt } from "@/components/catalogue/destination-art";
import { FaqList } from "@/components/catalogue/faq-list";
import { PackageCard } from "@/components/catalogue/package-card";
import { PriceTag } from "@/components/feedback/price-tag";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteUrl } from "@/config/site";
import { formatDate } from "@/lib/dates";
import { type CurrencyCode, formatMoney, isCurrencyCode, money } from "@/lib/money";
import {
  findSlugRedirect,
  staticSlugParams,
  getDestination,
  getPublishedSlugs,
} from "@/server/services/catalogue/queries";
import { getArticlesForDestination } from "@/server/services/content/articles";

export async function generateStaticParams() {
  const { destinations } = await getPublishedSlugs();
  return staticSlugParams(destinations);
}

export async function generateMetadata({ params }: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDestination(slug);
  if (!d) return { title: "Destination not found", robots: { index: false } };
  const title = d.seoTitle ?? `${d.name}, ${d.countryName}`;
  const description = d.seoDescription ?? d.summary;
  return {
    title,
    description,
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: { title, description, url: `/destinations/${d.slug}`, type: "article" },
  };
}

export default function DestinationPage(props: PageProps<"/destinations/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Destination params={props.params} />
    </Suspense>
  );
}

async function Destination({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDestination(slug);
  if (!d) {
    const target = await findSlugRedirect("destination", slug);
    if (target) permanentRedirect(`/destinations/${target}`);
    notFound();
  }

  const guides = await getArticlesForDestination(d.id);
  const code = d.budgetCurrency?.trim() ?? "";
  const currency: CurrencyCode | null = isCurrencyCode(code) ? code : null;
  const months = bestMonthsLabel(d.bestMonths);

  return (
    <article>
      <DestinationArt
        name={d.name}
        label={[d.city !== d.name ? d.city : null, d.countryName].filter(Boolean).join(", ")}
        size="lg"
      />

      <div className="container-page grid gap-12 py-10 md:py-14 lg:grid-cols-[1fr_340px] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-12">
          <div className="flex flex-col gap-5">
            <Breadcrumbs
              baseUrl={siteUrl}
              items={[
                { label: "Home", href: "/" },
                { label: "Destinations", href: "/destinations" },
                { label: d.name, href: `/destinations/${d.slug}` },
              ]}
            />
            <h1 className="sr-only">
              {d.name}, {d.countryName}
            </h1>
            <p className="font-heading text-2xl leading-snug text-navy-900 md:text-3xl">{d.summary}</p>
            {d.categories.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Travel styles">
                {d.categories.map((c) => (
                  <li key={c.slug}>
                    <Badge variant="secondary" asChild>
                      <Link href={`/destinations?category=${c.slug}`}>{c.name}</Link>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {d.overview && <p className="max-w-prose text-lg leading-relaxed text-ink">{d.overview}</p>}
          </div>

          {d.sections.map((s, i) => (
            <section key={i} className="flex max-w-prose flex-col gap-3">
              <h2 className="text-2xl">{s.title}</h2>
              <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{s.body}</p>
            </section>
          ))}

          <section aria-labelledby="entry" className="flex max-w-prose flex-col gap-3 rounded-lg bg-cloud-100 p-6">
            <h2 id="entry" className="flex items-center gap-2 text-xl">
              <FileText className="size-5 text-gold-700" aria-hidden="true" /> Entry and documents
            </h2>
            {d.entryGuidance ? (
              <>
                <p className="leading-relaxed whitespace-pre-line">{d.entryGuidance}</p>
                <p className="text-sm text-muted-foreground">
                  General guidance only. Requirements depend on your nationality and can change.
                  {d.entryGuidanceCheckedAt && ` Last checked ${formatDate(d.entryGuidanceCheckedAt)}.`}{" "}
                  {d.entryGuidanceSourceUrl && (
                    <a
                      href={d.entryGuidanceSourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="underline underline-offset-4"
                    >
                      Official source
                    </a>
                  )}
                </p>
              </>
            ) : (
              <p className="leading-relaxed">
                We only publish entry requirements once they’ve been checked against official government sources. Our
                visa team can tell you what applies to your passport and travel dates.
              </p>
            )}
            <Button asChild variant="outline" className="self-start">
              <Link href={`/contact?category=visa&destination=${d.slug}`}>Ask about visas for {d.name}</Link>
            </Button>
          </section>

          {d.packages.length > 0 && (
            <section aria-labelledby="pkgs" className="flex flex-col gap-6">
              <h2 id="pkgs" className="text-2xl">
                Trips to {d.name}
              </h2>
              <ul className="grid gap-6 md:grid-cols-2">
                {d.packages.map((p) => (
                  <li key={p.slug} className="flex">
                    <PackageCard p={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {guides.length > 0 && (
            <section aria-labelledby="guides" className="flex flex-col gap-4">
              <h2 id="guides" className="text-2xl">
                Read before you go
              </h2>
              <ul className="flex flex-col divide-y border-y">
                {guides.map((g) => (
                  <li key={g.slug} className="py-4">
                    <Link href={`/guides/${g.slug}`} className="text-lg font-medium underline-offset-4 hover:underline">
                      {g.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{g.excerpt}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <FaqList faqs={d.faqs} />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <dl className="flex flex-col gap-5 rounded-lg border bg-white p-6">
            {months && (
              <Fact icon={CalendarDays} label="Best time to visit">
                {months}
              </Fact>
            )}
            {d.suggestedDaysMin && (
              <Fact icon={Clock} label="Suggested stay">
                {d.suggestedDaysMin}–{d.suggestedDaysMax} days
              </Fact>
            )}
            {currency && d.dailyBudgetLowMinor !== null && (
              <Fact icon={Wallet} label="Daily budget per person">
                <PriceTag
                  value={money(d.dailyBudgetLowMinor, currency)}
                  source="configured"
                  basis={
                    d.dailyBudgetHighMinor !== null
                      ? `from; up to ${formatMoney(money(d.dailyBudgetHighMinor, currency))} depending on style`
                      : undefined
                  }
                  asOf={d.budgetCheckedAt ?? undefined}
                  size="sm"
                />
                {d.budgetSource && (
                  <span className="mt-1 block text-xs text-muted-foreground">Source: {d.budgetSource}</span>
                )}
              </Fact>
            )}
          </dl>
          <div className="surface-dark flex flex-col gap-4 rounded-lg bg-navy-900 p-6 text-navy-100">
            <p className="font-heading text-xl text-cloud-50">Plan a trip to {d.name}</p>
            <p className="text-sm leading-relaxed">
              Tell us your dates and budget. A consultant replies with options and confirms prices with suppliers before
              anything is booked.
            </p>
            <Button asChild variant="accent">
              <Link href={`/contact?category=custom_trip&destination=${d.slug}`}>
                Start planning <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      {d.related.length > 0 && (
        <section aria-labelledby="related" className="border-t bg-white">
          <div className="container-page flex flex-col gap-8 py-14">
            <h2 id="related" className="text-2xl">
              You might also like
            </h2>
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {d.related.map((r) => (
                <li key={r.slug}>
                  <DestinationCard d={{ ...r, categories: [] }} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TouristDestination",
          name: d.name,
          description: d.summary,
          url: `${siteUrl}/destinations/${d.slug}`,
          containedInPlace: { "@type": "Country", name: d.countryName },
        }}
      />
    </article>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-gold-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="text-sm text-navy-900">{children}</dd>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading destination">
      <Skeleton className="h-72 w-full rounded-none md:h-96" />
      <div className="container-page flex flex-col gap-4 py-10">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
