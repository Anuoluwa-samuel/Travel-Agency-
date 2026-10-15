/**
 * Static brand defaults. Runtime overrides (contact details, legal entity, social links)
 * come from the `settings` table so staff can edit them without a deploy.
 *
 * Contact and legal fields are intentionally empty: the UI hides anything that has not
 * been configured instead of showing invented details (RULES.md §1.5).
 */
export const brand = {
  name: "ORBIS",
  tagline: "Journeys, thoughtfully arranged.",
  description:
    "ORBIS plans and books international and domestic travel: holiday packages, flights, hotels, group trips and visa document preparation.",
  baseCurrency: "NGN",
  displayCurrencies: ["NGN", "USD", "GBP", "EUR"] as const,
  businessTimezone: "Africa/Lagos",
  defaultLocale: "en-NG",
  contact: {
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
  } as { email: string; phone: string; whatsapp: string; address: string },
  legal: {
    entityName: "",
    registrationNumber: "",
  } as { entityName: string; registrationNumber: string },
  social: {} as Partial<Record<"instagram" | "x" | "facebook" | "tiktok" | "linkedin", string>>,
} as const;

export type Brand = typeof brand;
