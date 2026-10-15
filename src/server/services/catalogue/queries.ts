import "server-only";
import { type SQL, and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  BUDGET_TIERS,
  DURATION_BUCKETS,
  type DestinationFilters,
  PAGE_SIZE,
  type PackageFilters,
} from "@/lib/validation/catalogue";
import { db } from "@/server/db/client";
import {
  countries,
  destinationCategories,
  destinationCategoryLinks,
  destinationSections,
  destinations,
  faqs,
  itineraryDays,
  itineraryItems,
  packageAccommodations,
  packageDepartures,
  packageDestinations,
  packageInclusions,
  packageOptions,
  packages,
  paymentPlans,
  policies,
  priceRules,
  regions,
  slugRedirects,
} from "@/server/db/schema";
import { isCurrencyCode, type Money, money } from "@/lib/money";
import { computeFromPrice, isBookableDeparture, resolveRule } from "@/server/services/pricing/from-price";

/*
 * Public catalogue reads. Every query here applies the publication rule (status = published and
 * published_at <= now()); UI code never filters by status itself.
 *
 * Results are cached with `use cache` and tagged so the admin CMS (Phase 5) can invalidate them
 * with `updateTag("catalogue")` or a per-item tag after edits.
 */

export const CATALOGUE_TAG = "catalogue";

const publishedDestination = and(eq(destinations.status, "published"), lte(destinations.publishedAt, sql`now()`));
const publishedPackage = and(eq(packages.status, "published"), lte(packages.publishedAt, sql`now()`));

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Reference data ───────────────────────────────────────────────────────────

export async function listRegions() {
  "use cache";
  cacheLife("days");
  cacheTag(CATALOGUE_TAG);
  return db.select({ slug: regions.slug, name: regions.name }).from(regions).orderBy(asc(regions.position));
}

export async function listCategories() {
  "use cache";
  cacheLife("days");
  cacheTag(CATALOGUE_TAG);
  return db
    .select({ slug: destinationCategories.slug, name: destinationCategories.name, kind: destinationCategories.kind })
    .from(destinationCategories)
    .orderBy(asc(destinationCategories.position));
}

// ─── Destinations ─────────────────────────────────────────────────────────────

const destinationCard = {
  id: destinations.id,
  slug: destinations.slug,
  name: destinations.name,
  city: destinations.city,
  kind: destinations.kind,
  summary: destinations.summary,
  countryName: countries.name,
  countryIso2: countries.iso2,
  regionName: regions.name,
  regionSlug: regions.slug,
  bestMonths: destinations.bestMonths,
  suggestedDaysMin: destinations.suggestedDaysMin,
  suggestedDaysMax: destinations.suggestedDaysMax,
  budgetCurrency: destinations.budgetCurrency,
  dailyBudgetLowMinor: destinations.dailyBudgetLowMinor,
  dailyBudgetHighMinor: destinations.dailyBudgetHighMinor,
  budgetSource: destinations.budgetSource,
  budgetCheckedAt: destinations.budgetCheckedAt,
  isFeatured: destinations.isFeatured,
};

export type DestinationCard = Awaited<ReturnType<typeof listDestinations>>["items"][number];

function destinationWhere(f: DestinationFilters): SQL | undefined {
  const where: (SQL | undefined)[] = [publishedDestination];
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(
      or(
        sql`to_tsvector('english', ${destinations.name} || ' ' || coalesce(${destinations.city}, '') || ' ' || ${destinations.summary}) @@ websearch_to_tsquery('english', ${f.q})`,
        ilike(destinations.name, like),
        ilike(destinations.city, like),
        ilike(countries.name, like),
      ),
    );
  }
  if (f.region) where.push(eq(regions.slug, f.region));
  if (f.categories.length) {
    where.push(
      inArray(
        destinations.id,
        db
          .select({ id: destinationCategoryLinks.destinationId })
          .from(destinationCategoryLinks)
          .innerJoin(destinationCategories, eq(destinationCategories.id, destinationCategoryLinks.categoryId))
          .where(inArray(destinationCategories.slug, f.categories)),
      ),
    );
  }
  if (f.month) where.push(sql`${destinations.bestMonths} @> ARRAY[${f.month}]::smallint[]`);
  if (f.budget) {
    const tier = BUDGET_TIERS[f.budget];
    where.push(eq(destinations.budgetCurrency, "NGN"));
    where.push(
      tier.rule === "lowAtMost"
        ? lte(destinations.dailyBudgetLowMinor, tier.amountMinor)
        : gte(destinations.dailyBudgetHighMinor, tier.amountMinor),
    );
  }
  if (f.duration) {
    const b = DURATION_BUCKETS[f.duration];
    // Overlap between the destination's suggested range and the bucket.
    where.push(lte(destinations.suggestedDaysMin, b.max), gte(destinations.suggestedDaysMax, b.min));
  }
  return and(...where);
}

export async function listDestinations(f: DestinationFilters) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);

  const where = destinationWhere(f);
  const order =
    f.sort === "name"
      ? [asc(destinations.name)]
      : f.sort === "budget"
        ? [sql`${destinations.dailyBudgetLowMinor} ASC NULLS LAST`, asc(destinations.name)]
        : [desc(destinations.isFeatured), asc(destinations.name)];

  const base = () =>
    db
      .select(destinationCard)
      .from(destinations)
      .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
      .leftJoin(regions, eq(regions.id, countries.regionId));

  const [items, [{ total }]] = await Promise.all([
    base()
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(destinations)
      .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
      .leftJoin(regions, eq(regions.id, countries.regionId))
      .where(where),
  ]);

  const cats = await categoriesFor(items.map((i) => i.id));
  return {
    items: items.map((i) => ({ ...i, categories: cats.get(i.id) ?? [] })),
    total,
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function categoriesFor(destinationIds: string[]) {
  const map = new Map<string, { slug: string; name: string }[]>();
  if (destinationIds.length === 0) return map;
  const rows = await db
    .select({
      destinationId: destinationCategoryLinks.destinationId,
      slug: destinationCategories.slug,
      name: destinationCategories.name,
      kind: destinationCategories.kind,
    })
    .from(destinationCategoryLinks)
    .innerJoin(destinationCategories, eq(destinationCategories.id, destinationCategoryLinks.categoryId))
    .where(inArray(destinationCategoryLinks.destinationId, destinationIds))
    .orderBy(asc(destinationCategories.position));
  for (const r of rows) {
    if (r.kind === "collection") continue;
    map.set(r.destinationId, [...(map.get(r.destinationId) ?? []), { slug: r.slug, name: r.name }]);
  }
  return map;
}

export async function getFeaturedDestinations(limit = 6) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  const { items } = await listDestinations({ categories: [], sort: "featured", page: 1 });
  return items.slice(0, limit);
}

export async function getCollections() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  const rows = await db
    .select({
      slug: destinationCategories.slug,
      name: destinationCategories.name,
      description: destinationCategories.description,
      destinations: sql<number>`count(${destinations.id})::int`,
    })
    .from(destinationCategories)
    .innerJoin(destinationCategoryLinks, eq(destinationCategoryLinks.categoryId, destinationCategories.id))
    .innerJoin(destinations, and(eq(destinations.id, destinationCategoryLinks.destinationId), publishedDestination))
    .where(eq(destinationCategories.kind, "collection"))
    .groupBy(destinationCategories.id)
    .orderBy(asc(destinationCategories.position));
  return rows.filter((r) => r.destinations > 0);
}

export async function getDestination(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, `destination:${slug}`);

  const [row] = await db
    .select({
      ...destinationCard,
      overview: destinations.overview,
      dailyBudgetMidMinor: destinations.dailyBudgetMidMinor,
      entryGuidance: destinations.entryGuidance,
      entryGuidanceSourceUrl: destinations.entryGuidanceSourceUrl,
      entryGuidanceCheckedAt: destinations.entryGuidanceCheckedAt,
      seoTitle: destinations.seoTitle,
      seoDescription: destinations.seoDescription,
      updatedAt: destinations.updatedAt,
    })
    .from(destinations)
    .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
    .leftJoin(regions, eq(regions.id, countries.regionId))
    .where(and(eq(destinations.slug, slug), publishedDestination));
  if (!row) return null;

  const [sections, faqRows, cats, related, pkgs] = await Promise.all([
    db
      .select({ kind: destinationSections.kind, title: destinationSections.title, body: destinationSections.body })
      .from(destinationSections)
      .where(eq(destinationSections.destinationId, row.id))
      .orderBy(asc(destinationSections.position)),
    db
      .select({ question: faqs.question, answer: faqs.answer })
      .from(faqs)
      .where(and(eq(faqs.ownerType, "destination"), eq(faqs.ownerId, row.id)))
      .orderBy(asc(faqs.position)),
    categoriesFor([row.id]),
    // Related: same region first, then anything else published.
    db
      .select(destinationCard)
      .from(destinations)
      .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
      .leftJoin(regions, eq(regions.id, countries.regionId))
      .where(and(publishedDestination, sql`${destinations.id} <> ${row.id}`))
      .orderBy(
        sql`CASE WHEN ${regions.slug} = ${row.regionSlug} THEN 0 ELSE 1 END`,
        desc(destinations.isFeatured),
        asc(destinations.name),
      )
      .limit(3),
    listPackageCards({ destinationId: row.id }),
  ]);

  return { ...row, categories: cats.get(row.id) ?? [], sections, faqs: faqRows, related, packages: pkgs };
}

// ─── Packages ─────────────────────────────────────────────────────────────────

async function fromPrices(packageIds: string[]) {
  const out = new Map<string, ReturnType<typeof computeFromPrice>>();
  if (packageIds.length === 0) return out;
  const [rules, opts, deps] = await Promise.all([
    db.select().from(priceRules).where(inArray(priceRules.packageId, packageIds)),
    db.select().from(packageOptions).where(inArray(packageOptions.packageId, packageIds)),
    db.select().from(packageDepartures).where(inArray(packageDepartures.packageId, packageIds)),
  ]);
  const today = todayIso();
  for (const id of packageIds) {
    out.set(
      id,
      computeFromPrice({
        rules: rules.filter((r) => r.packageId === id),
        options: opts.filter((o) => o.packageId === id),
        departures: deps.filter((d) => d.packageId === id),
        today,
      }),
    );
  }
  return out;
}

const packageCard = {
  id: packages.id,
  slug: packages.slug,
  title: packages.title,
  summary: packages.summary,
  durationDays: packages.durationDays,
  nights: packages.nights,
  dateMode: packages.dateMode,
  bookingMode: packages.bookingMode,
  availability: packages.availability,
  travelStyle: packages.travelStyle,
  isFeatured: packages.isFeatured,
  destinationSlug: destinations.slug,
  destinationName: destinations.name,
  countryName: countries.name,
};

export type PackageCard = Awaited<ReturnType<typeof listPackageCards>>[number];

async function listPackageCards(opts: { destinationId?: string; featuredOnly?: boolean; limit?: number }) {
  const rows = await db
    .select(packageCard)
    .from(packages)
    .innerJoin(destinations, eq(destinations.id, packages.primaryDestinationId))
    .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
    .where(
      and(
        publishedPackage,
        opts.destinationId ? eq(packages.primaryDestinationId, opts.destinationId) : undefined,
        opts.featuredOnly ? eq(packages.isFeatured, true) : undefined,
      ),
    )
    .orderBy(desc(packages.isFeatured), asc(packages.title))
    .limit(opts.limit ?? 12);
  const prices = await fromPrices(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, fromPrice: prices.get(r.id) ?? null }));
}

export async function getFeaturedPackages(limit = 3) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  return listPackageCards({ featuredOnly: true, limit });
}

export async function listPackages(f: PackageFilters) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);

  const where = and(
    publishedPackage,
    f.q
      ? or(
          ilike(packages.title, `%${escapeLike(f.q)}%`),
          ilike(packages.summary, `%${escapeLike(f.q)}%`),
          ilike(destinations.name, `%${escapeLike(f.q)}%`),
        )
      : undefined,
    f.destination ? eq(destinations.slug, f.destination) : undefined,
    f.duration
      ? and(
          gte(packages.durationDays, DURATION_BUCKETS[f.duration].min),
          lte(packages.durationDays, DURATION_BUCKETS[f.duration].max),
        )
      : undefined,
  );

  const rows = await db
    .select(packageCard)
    .from(packages)
    .innerJoin(destinations, eq(destinations.id, packages.primaryDestinationId))
    .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
    .where(where)
    .orderBy(
      ...(f.sort === "duration"
        ? [asc(packages.durationDays), asc(packages.title)]
        : [desc(packages.isFeatured), asc(packages.title)]),
    );

  const prices = await fromPrices(rows.map((r) => r.id));
  let items = rows.map((r) => ({ ...r, fromPrice: prices.get(r.id) ?? null }));
  if (f.sort === "price") {
    // Sorted after pricing because the "from" price is derived, not stored.
    items = items.sort((a, b) => {
      if (!a.fromPrice) return 1;
      if (!b.fromPrice) return -1;
      return a.fromPrice.amountMinor < b.fromPrice.amountMinor
        ? -1
        : a.fromPrice.amountMinor > b.fromPrice.amountMinor
          ? 1
          : 0;
    });
  }
  const total = items.length;
  return {
    items: items.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE),
    total,
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getPackage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG, `package:${slug}`);

  const [row] = await db
    .select({
      ...packageCard,
      description: packages.description,
      minPax: packages.minPax,
      maxPax: packages.maxPax,
      meetingInfo: packages.meetingInfo,
      cancellationPolicyId: packages.cancellationPolicyId,
      termsPolicyId: packages.termsPolicyId,
      seoTitle: packages.seoTitle,
      seoDescription: packages.seoDescription,
    })
    .from(packages)
    .innerJoin(destinations, eq(destinations.id, packages.primaryDestinationId))
    .innerJoin(countries, eq(countries.iso2, destinations.countryIso2))
    .where(and(eq(packages.slug, slug), publishedPackage));
  if (!row) return null;

  const [days, items, inclusions, stays, opts, deps, rules, plan, faqRows, extraDestinations] = await Promise.all([
    db.select().from(itineraryDays).where(eq(itineraryDays.packageId, row.id)).orderBy(asc(itineraryDays.dayNumber)),
    db
      .select({
        dayId: itineraryItems.itineraryDayId,
        kind: itineraryItems.kind,
        title: itineraryItems.title,
        description: itineraryItems.description,
        isOptional: itineraryItems.isOptional,
      })
      .from(itineraryItems)
      .innerJoin(itineraryDays, eq(itineraryDays.id, itineraryItems.itineraryDayId))
      .where(eq(itineraryDays.packageId, row.id))
      .orderBy(asc(itineraryItems.position)),
    db
      .select({ kind: packageInclusions.kind, text: packageInclusions.text })
      .from(packageInclusions)
      .where(eq(packageInclusions.packageId, row.id))
      .orderBy(asc(packageInclusions.position)),
    db
      .select()
      .from(packageAccommodations)
      .where(eq(packageAccommodations.packageId, row.id))
      .orderBy(asc(packageAccommodations.position)),
    db.select().from(packageOptions).where(eq(packageOptions.packageId, row.id)).orderBy(asc(packageOptions.position)),
    db
      .select()
      .from(packageDepartures)
      .where(eq(packageDepartures.packageId, row.id))
      .orderBy(asc(packageDepartures.startDate)),
    db.select().from(priceRules).where(eq(priceRules.packageId, row.id)),
    db.select().from(paymentPlans).where(eq(paymentPlans.packageId, row.id)),
    db
      .select({ question: faqs.question, answer: faqs.answer })
      .from(faqs)
      .where(and(eq(faqs.ownerType, "package"), eq(faqs.ownerId, row.id)))
      .orderBy(asc(faqs.position)),
    db
      .select({ slug: destinations.slug, name: destinations.name })
      .from(packageDestinations)
      .innerJoin(destinations, and(eq(destinations.id, packageDestinations.destinationId), publishedDestination))
      .where(eq(packageDestinations.packageId, row.id))
      .orderBy(asc(packageDestinations.position)),
  ]);

  const policyIds = [row.cancellationPolicyId, row.termsPolicyId].filter((x): x is string => Boolean(x));
  const policyRows = policyIds.length
    ? await db
        .select({
          id: policies.id,
          kind: policies.kind,
          title: policies.title,
          body: policies.body,
          version: policies.version,
        })
        .from(policies)
        .where(inArray(policies.id, policyIds))
    : [];

  // Everything date- or price-dependent is resolved here, inside the cache, so pages never
  // compute prices themselves (RULES.md §2) and prerendering never reads the clock.
  const today = todayIso();
  const priceOf = (departure: { id: string; startDate: string }, optionId: string): Money | null => {
    const rule = resolveRule(rules, departure, optionId, "adult");
    return rule && isCurrencyCode(rule.currency) ? money(rule.amountMinor, rule.currency) : null;
  };
  const rooms = opts.filter((o) => o.kind === "room");
  const addons = opts.filter((o) => o.kind === "addon");
  const upcoming = deps.filter((d) => d.startDate > today && d.status !== "cancelled");
  const nextBookable = upcoming.find((d) => isBookableDeparture(d, today)) ?? null;

  return {
    ...row,
    days: days.map((d) => ({ ...d, items: items.filter((i) => i.dayId === d.id) })),
    included: inclusions.filter((i) => i.kind === "included").map((i) => i.text),
    excluded: inclusions.filter((i) => i.kind === "excluded").map((i) => i.text),
    stays,
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, occupancy: r.occupancy })),
    departures: upcoming.map((d) => {
      const remaining = d.capacity - d.seatsHeld - d.seatsConfirmed;
      const bookable = isBookableDeparture(d, today);
      return {
        id: d.id,
        startDate: d.startDate,
        endDate: d.endDate,
        bookingDeadline: d.bookingDeadline,
        // Exact seat counts are not exposed publicly; only a coarse availability state.
        availability: !bookable
          ? ("closed" as const)
          : remaining <= 4 || d.status === "limited"
            ? ("limited" as const)
            : ("open" as const),
        prices: Object.fromEntries(rooms.map((r) => [r.id, priceOf(d, r.id)])) as Record<string, Money | null>,
      };
    }),
    addons: addons.map((a) => ({ id: a.id, name: a.name, price: nextBookable ? priceOf(nextBookable, a.id) : null })),
    fromPrice: computeFromPrice({ rules, options: opts, departures: deps, today }),
    paymentPlan: plan[0] ?? null,
    cancellationPolicy: policyRows.find((p) => p.kind === "cancellation") ?? null,
    terms: policyRows.find((p) => p.kind === "terms") ?? null,
    faqs: faqRows,
    destinations: extraDestinations,
  };
}

// ─── SEO helpers ──────────────────────────────────────────────────────────────

export async function getPublishedSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  const [d, p] = await Promise.all([
    db
      .select({ slug: destinations.slug, updatedAt: destinations.updatedAt })
      .from(destinations)
      .where(publishedDestination),
    db.select({ slug: packages.slug, updatedAt: packages.updatedAt }).from(packages).where(publishedPackage),
  ]);
  return { destinations: d, packages: p };
}

/**
 * Cache Components requires `generateStaticParams` to return at least one param. On a fresh
 * deployment with nothing published yet, prerender a placeholder that resolves to 404 so the
 * build still succeeds and real pages render on first visit.
 */
export const EMPTY_CATALOGUE_SLUG = "__none";
export function staticSlugParams(rows: { slug: string }[]) {
  return rows.length > 0 ? rows.map((r) => ({ slug: r.slug })) : [{ slug: EMPTY_CATALOGUE_SLUG }];
}

/** Old slug → current slug, for permanent redirects after a rename (journeys.md SEO rules). */
export async function findSlugRedirect(entityType: "destination" | "package", fromSlug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
  const [row] = await db
    .select({ toSlug: slugRedirects.toSlug })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.fromSlug, fromSlug)));
  return row?.toSlug ?? null;
}
