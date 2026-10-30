import "server-only";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db/client";
import { fees, packageDepartures, packageOptions, packages, paymentPlans, priceRules } from "@/server/db/schema";
import type { QuoteContext } from "@/server/services/pricing/quote";

type Executor = typeof db | Tx;

export interface LoadedPackage {
  id: string;
  slug: string;
  title: string;
  bookingMode: "instant" | "request" | "enquiry";
  durationDays: number;
  cancellationPolicyId: string | null;
  termsPolicyId: string | null;
}

/**
 * Loads everything the quote engine needs for one departure. With `lock`, the departure row is
 * locked FOR UPDATE so seat counts can't change until the transaction ends.
 */
export async function loadQuoteContext(
  ex: Executor,
  packageId: string,
  departureId: string,
  opts: { lock?: boolean; today: string },
): Promise<{ pkg: LoadedPackage; ctx: QuoteContext } | null> {
  const [pkg] = await ex
    .select({
      id: packages.id,
      slug: packages.slug,
      title: packages.title,
      bookingMode: packages.bookingMode,
      durationDays: packages.durationDays,
      minPax: packages.minPax,
      maxPax: packages.maxPax,
      cancellationPolicyId: packages.cancellationPolicyId,
      termsPolicyId: packages.termsPolicyId,
    })
    .from(packages)
    .where(and(eq(packages.id, packageId), eq(packages.status, "published"), lte(packages.publishedAt, sql`now()`)));
  if (!pkg) return null;

  const depQuery = ex
    .select()
    .from(packageDepartures)
    .where(and(eq(packageDepartures.id, departureId), eq(packageDepartures.packageId, packageId)));
  const [dep] = opts.lock ? await depQuery.for("update") : await depQuery;
  if (!dep) return null;

  const [options, rules, feeRows, plan] = await Promise.all([
    ex.select().from(packageOptions).where(eq(packageOptions.packageId, packageId)),
    ex.select().from(priceRules).where(eq(priceRules.packageId, packageId)),
    ex
      .select()
      .from(fees)
      .where(or(eq(fees.packageId, packageId), isNull(fees.packageId))),
    ex.select().from(paymentPlans).where(eq(paymentPlans.packageId, packageId)),
  ]);

  return {
    pkg,
    ctx: {
      package: { minPax: pkg.minPax, maxPax: pkg.maxPax },
      options: options.map((o) => ({
        id: o.id,
        kind: o.kind,
        name: o.name,
        pricingBasis: o.pricingBasis,
        occupancy: o.occupancy,
      })),
      rules,
      fees: feeRows.map((f) => ({ ...f, currency: f.currency?.trim() ?? null })),
      plan: plan[0]
        ? {
            depositBasisPoints: plan[0].depositBasisPoints,
            depositMinMinor: plan[0].depositMinMinor,
            balanceDueDaysBefore: plan[0].balanceDueDaysBefore,
          }
        : null,
      departure: {
        id: dep.id,
        startDate: dep.startDate,
        endDate: dep.endDate,
        status: dep.status,
        bookingDeadline: dep.bookingDeadline,
        capacity: dep.capacity,
        seatsHeld: dep.seatsHeld,
        seatsConfirmed: dep.seatsConfirmed,
      },
      today: opts.today,
    },
  };
}

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);
