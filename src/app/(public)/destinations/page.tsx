import { MapPinned } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DestinationCard } from "@/components/catalogue/destination-card";
import { DestinationFilterForm } from "@/components/catalogue/destination-filters";
import { Pager } from "@/components/catalogue/pager";
import { EmptyState } from "@/components/feedback/states";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteUrl } from "@/config/site";
import {
  type RawSearchParams,
  activeFilterCount,
  parseDestinationFilters,
  toQueryString,
} from "@/lib/validation/catalogue";
import { listCategories, listDestinations, listRegions } from "@/server/services/catalogue/queries";

export async function generateMetadata({ searchParams }: PageProps<"/destinations">): Promise<Metadata> {
  const f = parseDestinationFilters(await searchParams);
  const filtered = activeFilterCount(f) > 0 || f.page > 1 || f.sort !== "featured";
  return {
    title: "Destinations",
    description: "Explore destinations by region, travel style, season and budget, with honest cost estimates.",
    alternates: { canonical: "/destinations" },
    // Filter and page combinations are not indexed, so they can't create duplicate pages.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function DestinationsPage({ searchParams }: PageProps<"/destinations">) {
  return (
    <div className="container-page flex flex-col gap-10 py-10 md:py-14">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Destinations", href: "/destinations" },
          ]}
        />
        <h1 className="text-4xl md:text-5xl">Where to next?</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Filter by season, style and budget. Daily budgets are planning estimates per person, not quotes.
        </p>
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const filters = parseDestinationFilters(sp);
  const [{ items, total, page, pageCount }, regions, categories] = await Promise.all([
    listDestinations(filters),
    listRegions(),
    listCategories(),
  ]);
  const active = activeFilterCount(filters);
  const hrefFor = (p: number) =>
    `/destinations${toQueryString({
      q: filters.q,
      region: filters.region,
      category: filters.categories,
      month: filters.month,
      budget: filters.budget,
      duration: filters.duration,
      sort: filters.sort === "featured" ? undefined : filters.sort,
      page: p > 1 ? p : undefined,
    })}`;

  return (
    <div className="grid gap-10 md:grid-cols-[260px_1fr] lg:gap-14">
      <aside>
        <DestinationFilterForm filters={filters} regions={regions} categories={categories} activeCount={active} />
      </aside>
      <section aria-labelledby="results-heading" className="flex flex-col gap-8">
        <h2 id="results-heading" className="font-sans text-sm font-normal text-muted-foreground" aria-live="polite">
          {total === 1 ? "1 destination" : `${total} destinations`}
          {active > 0 && " match your filters"}
        </h2>
        {items.length === 0 ? (
          <EmptyState
            icon={MapPinned}
            title="No destinations match those filters"
            description="Try fewer filters, or tell us what you have in mind and a consultant will suggest options."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link href="/destinations">Clear filters</Link>
                </Button>
                <Button asChild>
                  <Link href="/contact?category=custom_trip">Ask a consultant</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((d) => (
              <li key={d.slug}>
                <DestinationCard d={d} />
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-10 md:grid-cols-[260px_1fr]" aria-busy="true" aria-label="Loading destinations">
      <Skeleton className="h-96 w-full" />
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full" />
        ))}
      </div>
    </div>
  );
}
