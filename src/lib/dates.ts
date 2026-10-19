/** Display helpers. Dates are stored in UTC; the business timezone is Africa/Lagos. */
export const BUSINESS_TZ = "Africa/Lagos";

export function formatDate(value: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: typeof value === "string" && value.length === 10 ? "UTC" : BUSINESS_TZ,
    ...opts,
  });
}
