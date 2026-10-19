import { CalendarDays, Clock } from "lucide-react";
import Link from "next/link";
import { type CurrencyCode, formatMoney, isCurrencyCode, money } from "@/lib/money";
import { MONTHS } from "@/lib/validation/catalogue";
import type { DestinationCard as Destination } from "@/server/services/catalogue/queries";
import { DestinationArt } from "./destination-art";

export function bestMonthsLabel(months: number[]): string | null {
  if (!months.length) return null;
  const sorted = [...months].sort((a, b) => a - b);
  return sorted.map((m) => MONTHS[m - 1]).join(", ");
}

export function DestinationCard({ d }: { d: Destination }) {
  const code = d.budgetCurrency?.trim() ?? "";
  const currency: CurrencyCode | null = isCurrencyCode(code) ? code : null;
  return (
    <article className="group relative flex flex-col gap-4">
      <DestinationArt
        name={d.name}
        label={d.countryName}
        className="transition-transform duration-200 group-hover:-translate-y-0.5"
      />
      <div className="flex flex-col gap-2">
        <h3 className="text-xl">
          <Link href={`/destinations/${d.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {d.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{d.summary}</p>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-700">
          {d.suggestedDaysMin && (
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden="true" />
              <dt className="sr-only">Suggested length</dt>
              <dd>
                {d.suggestedDaysMin}–{d.suggestedDaysMax} days
              </dd>
            </div>
          )}
          {d.bestMonths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <dt className="sr-only">Best months</dt>
              <dd className="max-w-[16rem] truncate">{bestMonthsLabel(d.bestMonths)}</dd>
            </div>
          )}
        </dl>
        {currency && d.dailyBudgetLowMinor !== null && (
          <p className="tabular text-sm text-gold-700">
            ≈ {formatMoney(money(d.dailyBudgetLowMinor, currency))}+ per person per day
            <span className="text-muted-foreground"> · estimate</span>
          </p>
        )}
      </div>
    </article>
  );
}
