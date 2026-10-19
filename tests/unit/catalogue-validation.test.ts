import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  parseDestinationFilters,
  parsePackageFilters,
  toQueryString,
} from "@/lib/validation/catalogue";
import { enquirySchema } from "@/lib/validation/enquiry";

describe("parseDestinationFilters", () => {
  it("parses valid params and applies defaults", () => {
    const f = parseDestinationFilters({
      q: " zanzibar ",
      region: "africa",
      category: ["beach", "romantic"],
      month: "7",
      page: "2",
    });
    expect(f).toMatchObject({
      q: "zanzibar",
      region: "africa",
      categories: ["beach", "romantic"],
      month: 7,
      sort: "featured",
      page: 2,
    });
    expect(activeFilterCount(f)).toBe(5);
  });

  it("drops invalid values instead of failing", () => {
    const f = parseDestinationFilters({
      region: "Africa'; drop table",
      month: "13",
      budget: "cheap",
      page: "-1",
      sort: "evil",
      category: "BAD SLUG",
    });
    expect(f).toEqual({
      q: undefined,
      region: undefined,
      categories: [],
      month: undefined,
      budget: undefined,
      duration: undefined,
      sort: "featured",
      page: 1,
    });
  });

  it("caps the number of categories", () => {
    const f = parseDestinationFilters({ category: Array.from({ length: 20 }, (_, i) => `c${i}`) });
    expect(f.categories).toHaveLength(6);
  });
});

describe("parsePackageFilters", () => {
  it("accepts known sorts and durations", () => {
    expect(parsePackageFilters({ sort: "price", duration: "week" })).toMatchObject({
      sort: "price",
      duration: "week",
      page: 1,
    });
  });
});

describe("toQueryString", () => {
  it("omits empty values and repeats arrays", () => {
    expect(toQueryString({ q: "x", region: undefined, category: ["a", "b"], page: 2, empty: "" })).toBe(
      "?q=x&category=a&category=b&page=2",
    );
    expect(toQueryString({})).toBe("");
  });
});

describe("enquirySchema", () => {
  const base = {
    category: "custom_trip",
    name: "Ada Obi",
    email: "Ada@Example.com",
    message: "Looking for a beach week in December.",
  };

  it("normalises and applies defaults", () => {
    const r = enquirySchema.parse(base);
    expect(r).toMatchObject({
      email: "ada@example.com",
      adults: 1,
      children: 0,
      preferredContact: "email",
      budgetCurrency: "NGN",
      marketingConsent: false,
    });
    expect(r.phone).toBeUndefined();
    expect(r.travelFrom).toBeUndefined();
  });

  it("requires a phone number for phone or WhatsApp contact", () => {
    const r = enquirySchema.safeParse({ ...base, preferredContact: "whatsapp" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["phone"]);
  });

  it("rejects reversed dates, zero travellers and malformed budgets", () => {
    expect(enquirySchema.safeParse({ ...base, travelFrom: "2026-12-10", travelTo: "2026-12-01" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, adults: "0", children: "0" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, budget: "lots" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, budget: "2,500,000.50" }).success).toBe(true);
  });

  it("rejects unknown categories and short messages", () => {
    expect(enquirySchema.safeParse({ ...base, category: "loans" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, message: "hi" }).success).toBe(false);
  });
});
