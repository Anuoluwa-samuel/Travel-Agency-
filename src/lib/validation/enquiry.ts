import { z } from "zod";
import { emailSchema } from "./auth";

export const ENQUIRY_CATEGORIES = {
  custom_trip: "Plan a custom trip",
  package: "A package on this site",
  flight: "Flights",
  hotel: "Hotels",
  visa: "Visa document help",
  group: "Group trip",
  corporate: "Corporate travel",
  other: "Something else",
} as const;
export type EnquiryCategory = keyof typeof ENQUIRY_CATEGORIES;

export const BUDGET_CURRENCIES = ["NGN", "USD", "GBP", "EUR"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.iso.date("Use a valid date").optional())
  .optional();

/**
 * Enquiry form. Shared by the client form (instant feedback) and the server action (the
 * authority). Budget is entered in major units and converted to minor units on the server.
 */
export const enquirySchema = z
  .object({
    category: z.enum(Object.keys(ENQUIRY_CATEGORIES) as [EnquiryCategory, ...EnquiryCategory[]], {
      error: "Choose what you need help with",
    }),
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: emailSchema,
    phone: optionalText(32).refine((v) => !v || /^[+\d][\d\s()-]{6,30}$/.test(v), "Enter a valid phone number"),
    preferredContact: z.enum(["email", "phone", "whatsapp"]).default("email"),
    destinationSlug: optionalText(80).refine((v) => !v || /^[a-z0-9-]+$/.test(v), "Invalid destination"),
    packageSlug: optionalText(120).refine((v) => !v || /^[a-z0-9-]+$/.test(v), "Invalid package"),
    destinationText: optionalText(120),
    departureCity: optionalText(80),
    travelFrom: isoDate,
    travelTo: isoDate,
    adults: z.coerce.number().int().min(0).max(99).default(1),
    children: z.coerce.number().int().min(0).max(99).default(0),
    budget: optionalText(20).refine(
      (v) => !v || /^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, "")),
      "Enter an amount, e.g. 2500000",
    ),
    budgetCurrency: z.enum(BUDGET_CURRENCIES).default("NGN"),
    message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
    marketingConsent: z.coerce.boolean().default(false),
  })
  .refine((v) => v.adults + v.children >= 1, { path: ["adults"], message: "At least one traveller" })
  .refine((v) => !v.travelFrom || !v.travelTo || v.travelFrom <= v.travelTo, {
    path: ["travelTo"],
    message: "Return date must be after the start date",
  })
  .refine((v) => v.preferredContact === "email" || Boolean(v.phone), {
    path: ["phone"],
    message: "Add a phone number so we can call or message you",
  });

export type EnquiryInput = z.input<typeof enquirySchema>;
export type EnquiryValues = z.output<typeof enquirySchema>;
