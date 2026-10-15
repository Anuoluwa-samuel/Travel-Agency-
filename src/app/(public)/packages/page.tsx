import { Luggage } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PackageCard } from "@/components/catalogue/package-card";
import { Pager } from "@/components/catalogue/pager";
import { EmptyState } from "@/components/feedback/states";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteUrl } from "@/config/site";
import {
  DURATION_BUCKETS,
  PACKAGE_SORTS,
  type RawSearchParams,
  activeFilterCount,
  parsePackageFilters,
  toQueryString,
} from "@/lib/validation/catalogue";
import { listDestinations, listPackages } from "@/server/services/catalogue/queries";

export async function generateMetadata({ searchParams }: PageProps<"/packages">): Promise<Metadata> {
  const f = parsePackageFilters(await searchParams);
  const filtered = activeFilterCount(f) > 0 || f.page > 1 || f.sort !== "featured";
  return {
    title: "Holiday packages",
    description: "Curated holiday packages with day-by-day itineraries, clear inclusions and transparent terms.",
    alternates: { canonical: "/packages" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const selectClass = "border-input h-11 w-full rounded-md border bg-white px-3 text-sm";

export default function PackagesPage({ searchParams }: PageProps<"/packages">) {
  return (
    <div className="container-page flex flex-col gap-10 py-10 md:py-14">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Packages", href: "/packages" },
          ]}
        />
        <h1 className="text-4xl md:text-5xl">Holiday packages</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Itineraries we’ve put together and priced. Every package can be adjusted to your dates and group.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const f = parsePackageFilters(await searchParams);
  const [{ items, total, page, pageCount }, dests] = await Promise.all([
    listPackages(f),
    listDestinations({ categories: [], sort: "name", page: 1 }),
  ]);
  const active = activeFilterCount(f);
  const hrefFor = (p: number) =>
    `/packages${toQueryString({
      q: f.q,
      destination: f.destination,
      duration: f.duration,
      sort: f.sort === "featured" ? undefined : f.sort,
      page: p > 1 ? p : undefined,
    })}`;

  return (
    <div className="flex flex-col gap-8">
      <form
        method="get"
        action="/packages"
        role="search"
        aria-label="Filter packages"
        className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <label className="sr-only" htmlFor="pq">
          Search packages
        </label>
        <input
          id="pq"
          name="q"
          type="search"
          defaultValue={f.q}
          placeholder="Search packages"
          className={selectClass}
          maxLength={80}
        />
        <label className="sr-only" htmlFor="pdest">
          Destination
        </label>
        <select id="pdest" name="destination" defaultValue={f.destination ?? ""} className={selectClass}>
          <option value="">All destinations</option>
          {dests.items.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="pdur">
          Trip length
        </label>
        <select id="pdur" name="duration" defaultValue={f.duration ?? ""} className={selectClass}>
          <option value="">Any length</option>
          {Object.entries(DURATION_BUCKETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="psort">
          Sort by
        </label>
        <select id="psort" name="sort" defaultValue={f.sort} className={selectClass}>
          {Object.entries(PACKAGE_SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Search
          </Button>
          {active > 0 && (
            <Button asChild variant="ghost">
              <Link href="/packages">Reset</Link>
            </Button>
          )}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 1 ? "1 package" : `${total} packages`}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title="No packages match"
          description="We build custom itineraries too. Tell us where and when, and a consultant will put options together."
          action={
            <Button asChild>
              <Link href="/contact?category=custom_trip">Request a custom trip</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <li key={p.slug} className="flex">
              <PackageCard p={p} />
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
