import { cn } from "cn";
import { formatMoney, type Money } from "@/lib/money";

/**
 * Every displayed price says where it came from (RULES.md §1.6).
 * - `supplier`: a live or confirmed supplier price
 * - `configured`: a price or estimate maintained by ORBIS staff
 * - `ai`: an AI planning estimate
 * - `quote`: a server-calculated quote the customer can accept
 * - `package`: ORBIS's published package price; final amount is confirmed in the quote
 */
export type PriceSource = "supplier" | "configured" | "ai" | "quote" | "package";

const sourceLabel: Record<PriceSource, string> = {
  supplier: "Supplier price",
  configured: "Estimate",
  ai: "AI estimate",
  quote: "Quoted price",
  package: "Confirmed when quoted",
};

export function PriceTag({
  value,
  source,
  basis,
  asOf,
  indicative = false,
  size = "md",
  className,
}: {
  value: Money;
  source: PriceSource;
  /** e.g. "per person, twin share" */
  basis?: string;
  /** When the price was sourced or calculated. */
  asOf?: Date;
  /** Converted for display only; the charged amount may differ. */
  indicative?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const isEstimate = source === "configured" || source === "ai";
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "tabular font-semibold",
          size === "sm" && "text-base",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl",
          isEstimate ? "text-gold-700" : "text-navy-900",
        )}
      >
        {isEstimate && <span aria-hidden="true">≈ </span>}
        {formatMoney(value)}
      </span>
      <span className="text-xs text-muted-foreground">
        {[basis, sourceLabel[source], indicative ? "indicative conversion" : null].filter(Boolean).join(" · ")}
        {asOf && (
          <>
            {" · "}
            <time dateTime={asOf.toISOString()}>
              as of {asOf.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </time>
          </>
        )}
      </span>
    </div>
  );
}
