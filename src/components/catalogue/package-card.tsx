import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PriceTag } from "@/components/feedback/price-tag";
import type { PackageCard as Pkg } from "@/server/services/catalogue/queries";

export const bookingModeLabel = {
  instant: "Book online",
  request: "Request to book",
  enquiry: "Enquire for a quote",
} as const;

export function PackageCard({ p }: { p: Pkg }) {
  return (
    <article className="group relative flex flex-col justify-between gap-6 rounded-lg border bg-white p-6 transition-shadow duration-200 hover:shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3">
        <p className="eyebrow">
          {p.destinationName}, {p.countryName}
        </p>
        <h3 className="text-xl leading-snug">
          <Link href={`/packages/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {p.title}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
      </div>
      <div className="flex items-end justify-between gap-4 border-t pt-4">
        {p.fromPrice ? (
          <PriceTag
            value={p.fromPrice}
            source="package"
            basis={`from, per person · ${p.durationDays} days`}
            size="sm"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{p.durationDays} days · price on request</p>
        )}
        <span className="flex items-center gap-1 text-sm font-medium whitespace-nowrap text-navy-700">
          {bookingModeLabel[p.bookingMode]} <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
