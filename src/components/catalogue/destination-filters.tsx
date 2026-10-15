import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FilterDisclosure } from "./filter-disclosure";
import {
  BUDGET_TIERS,
  DESTINATION_SORTS,
  DURATION_BUCKETS,
  type DestinationFilters,
  MONTHS_LONG,
} from "@/lib/validation/catalogue";

const selectClass =
  "border-input h-11 w-full rounded-md border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * Plain GET form: filtering works without JavaScript, every state has a shareable URL, and the
 * server re-validates every value (lib/validation/catalogue.ts).
 */
export function DestinationFilterForm({
  filters,
  regions,
  categories,
  activeCount,
}: {
  filters: DestinationFilters;
  regions: { slug: string; name: string }[];
  categories: { slug: string; name: string; kind: string }[];
  activeCount: number;
}) {
  const styles = categories.filter((c) => c.kind !== "collection");
  const collections = categories.filter((c) => c.kind === "collection");
  return (
    <form
      method="get"
      action="/destinations"
      className="flex flex-col gap-6"
      role="search"
      aria-label="Filter destinations"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="q" className="text-sm font-medium">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="City, country or idea"
          className={selectClass}
          maxLength={80}
        />
      </div>

      <FilterDisclosure
        activeCount={activeCount}
        className="group rounded-lg border bg-white md:border-0 md:bg-transparent"
      >
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-medium md:hidden">
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters{activeCount > 0 && ` (${activeCount})`}
        </summary>
        <div className="flex flex-col gap-6 p-4 md:p-0">
          <Field label="Region" id="region">
            <select id="region" name="region" defaultValue={filters.region ?? ""} className={selectClass}>
              <option value="">Anywhere</option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Travel style</legend>
            {[...styles, ...collections].map((c) => (
              <label key={c.slug} className="flex min-h-9 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="category"
                  value={c.slug}
                  defaultChecked={filters.categories.includes(c.slug)}
                  className="size-4 accent-navy-900"
                />
                {c.name}
              </label>
            ))}
          </fieldset>

          <Field label="When" id="month">
            <select id="month" name="month" defaultValue={filters.month ?? ""} className={selectClass}>
              <option value="">Any month</option>
              {MONTHS_LONG.map((m, i) => (
                <option key={m} value={i + 1}>
                  Good in {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Daily budget (estimate)" id="budget">
            <select id="budget" name="budget" defaultValue={filters.budget ?? ""} className={selectClass}>
              <option value="">Any budget</option>
              {Object.entries(BUDGET_TIERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Trip length" id="duration">
            <select id="duration" name="duration" defaultValue={filters.duration ?? ""} className={selectClass}>
              <option value="">Any length</option>
              {Object.entries(DURATION_BUCKETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sort by" id="sort">
            <select id="sort" name="sort" defaultValue={filters.sort} className={selectClass}>
              {Object.entries(DESTINATION_SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Show results
            </Button>
            {activeCount > 0 && (
              <Button asChild variant="ghost">
                <Link href="/destinations">Reset</Link>
              </Button>
            )}
          </div>
        </div>
      </FilterDisclosure>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
