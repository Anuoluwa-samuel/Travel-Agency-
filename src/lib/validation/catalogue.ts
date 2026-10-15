import { z } from "zod";

/**
 * Catalogue filters parsed from URL search params. Invalid values are dropped rather than
 * erroring, so a hand-edited or stale URL still shows results (and the page stays crawlable).
 */

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const asArray = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/**
 * Budget tiers compare against each destination's estimated daily budget (NGN, per person).
 * `value`/`mid` match when the low estimate fits; `premium` matches destinations whose high
 * estimate reaches the threshold.
 */
export const BUDGET_TIERS = {
  value: { label: "Great value", rule: "lowAtMost", amountMinor: 10_000_000n },
  mid: { label: "Mid-range", rule: "lowAtMost", amountMinor: 20_000_000n },
  premium: { label: "Premium", rule: "highAtLeast", amountMinor: 40_000_000n },
} as const;
export type BudgetTier = keyof typeof BUDGET_TIERS;

export const DURATION_BUCKETS = {
  short: { label: "Up to 4 days", min: 1, max: 4 },
  week: { label: "5–8 days", min: 5, max: 8 },
  long: { label: "9+ days", min: 9, max: 365 },
} as const;
export type DurationBucket = keyof typeof DURATION_BUCKETS;

export const DESTINATION_SORTS = { featured: "Featured", name: "Name (A–Z)", budget: "Lowest daily budget" } as const;
export const PACKAGE_SORTS = { featured: "Featured", price: "Lowest price", duration: "Shortest first" } as const;

export const PAGE_SIZE = 12;

function pick<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const r = schema.safeParse(value);
  return r.success ? r.data : undefined;
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface DestinationFilters {
  q?: string;
  region?: string;
  categories: string[];
  month?: number;
  budget?: BudgetTier;
  duration?: DurationBucket;
  sort: keyof typeof DESTINATION_SORTS;
  page: number;
}

export function parseDestinationFilters(sp: RawSearchParams): DestinationFilters {
  return {
    q: pick(z.string().trim().min(1).max(80), first(sp.q)),
    region: pick(slug, first(sp.region)),
    categories: asArray(sp.category)
      .map((c) => pick(slug, c))
      .filter((c): c is string => Boolean(c))
      .slice(0, 6),
    month: pick(z.coerce.number().int().min(1).max(12), first(sp.month)),
    budget: pick(z.enum(Object.keys(BUDGET_TIERS) as [BudgetTier, ...BudgetTier[]]), first(sp.budget)),
    duration: pick(z.enum(Object.keys(DURATION_BUCKETS) as [DurationBucket, ...DurationBucket[]]), first(sp.duration)),
    sort: pick(z.enum(["featured", "name", "budget"]), first(sp.sort)) ?? "featured",
    page: pick(z.coerce.number().int().min(1).max(500), first(sp.page)) ?? 1,
  };
}

export interface PackageFilters {
  q?: string;
  destination?: string;
  duration?: DurationBucket;
  sort: keyof typeof PACKAGE_SORTS;
  page: number;
}

export function parsePackageFilters(sp: RawSearchParams): PackageFilters {
  return {
    q: pick(z.string().trim().min(1).max(80), first(sp.q)),
    destination: pick(slug, first(sp.destination)),
    duration: pick(z.enum(Object.keys(DURATION_BUCKETS) as [DurationBucket, ...DurationBucket[]]), first(sp.duration)),
    sort: pick(z.enum(["featured", "price", "duration"]), first(sp.sort)) ?? "featured",
    page: pick(z.coerce.number().int().min(1).max(500), first(sp.page)) ?? 1,
  };
}

/** Number of active filters, excluding sort and page. Drives "Reset" and indexing rules. */
export function activeFilterCount(f: DestinationFilters | PackageFilters): number {
  let n = 0;
  if (f.q) n++;
  if ("region" in f && f.region) n++;
  if ("categories" in f) n += f.categories.length;
  if ("month" in f && f.month) n++;
  if ("budget" in f && f.budget) n++;
  if ("destination" in f && f.destination) n++;
  if (f.duration) n++;
  return n;
}

/** Build a query string for a filter state, omitting defaults. */
export function toQueryString(params: Record<string, string | number | string[] | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, x));
    else usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
