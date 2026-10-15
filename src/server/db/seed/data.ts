/**
 * Development seed data. Places are real; every number, itinerary and price below is
 * FICTIONAL demo content for local development and must not be shown as live inventory.
 * Budget sources are labelled accordingly, and no visa or entry rules are seeded: that
 * guidance must come from checked official sources (PRD §8).
 */

export const SEED_SOURCE_LABEL = "ORBIS demo data (fictional, not verified)";

export const regions = [
  { slug: "africa", name: "Africa", position: 1 },
  { slug: "europe", name: "Europe", position: 2 },
  { slug: "middle-east", name: "Middle East", position: 3 },
  { slug: "asia", name: "Asia", position: 4 },
  { slug: "americas", name: "Americas", position: 5 },
] as const;

export const countries = [
  { iso2: "NG", name: "Nigeria", region: "africa", currency: "NGN", callingCode: "+234" },
  { iso2: "GH", name: "Ghana", region: "africa", currency: "GHS", callingCode: "+233" },
  { iso2: "KE", name: "Kenya", region: "africa", currency: "KES", callingCode: "+254" },
  { iso2: "TZ", name: "Tanzania", region: "africa", currency: "TZS", callingCode: "+255" },
  { iso2: "ZA", name: "South Africa", region: "africa", currency: "ZAR", callingCode: "+27" },
  { iso2: "MA", name: "Morocco", region: "africa", currency: "MAD", callingCode: "+212" },
  { iso2: "AE", name: "United Arab Emirates", region: "middle-east", currency: "AED", callingCode: "+971" },
  { iso2: "PT", name: "Portugal", region: "europe", currency: "EUR", callingCode: "+351" },
  { iso2: "GB", name: "United Kingdom", region: "europe", currency: "GBP", callingCode: "+44" },
  { iso2: "FR", name: "France", region: "europe", currency: "EUR", callingCode: "+33" },
  { iso2: "ID", name: "Indonesia", region: "asia", currency: "IDR", callingCode: "+62" },
  { iso2: "US", name: "United States", region: "americas", currency: "USD", callingCode: "+1" },
] as const;

export const categories = [
  { slug: "beach", name: "Beach", kind: "style" },
  { slug: "culture", name: "Culture & heritage", kind: "style" },
  { slug: "adventure", name: "Adventure", kind: "style" },
  { slug: "luxury", name: "Luxury", kind: "style" },
  { slug: "budget", name: "Great value", kind: "style" },
  { slug: "city", name: "City break", kind: "style" },
  { slug: "romantic", name: "Romantic", kind: "purpose" },
  { slug: "family", name: "Family-friendly", kind: "purpose" },
  { slug: "groups", name: "Friends & groups", kind: "purpose" },
  { slug: "honeymoon", name: "Honeymoon escapes", kind: "collection" },
  { slug: "weekend-escapes", name: "Weekend escapes", kind: "collection" },
  { slug: "affordable-international", name: "Affordable international trips", kind: "collection" },
] as const;

/** Daily budgets in NGN minor units (kobo). Fictional. */
export const destinations = [
  {
    slug: "zanzibar",
    name: "Zanzibar",
    countryIso2: "TZ",
    city: "Stone Town",
    kind: "island",
    summary: "Spice-scented alleys, dhow sunsets and long white beaches on the Indian Ocean.",
    overview:
      "Zanzibar pairs the layered history of Stone Town with quiet beaches on the north and east coasts. Most visitors split their stay between town and coast.",
    bestMonths: [6, 7, 8, 9, 10, 12, 1, 2],
    days: [5, 9],
    budget: [9_500_000n, 18_000_000n, 42_000_000n],
    categories: ["beach", "romantic", "honeymoon"],
    featured: true,
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    countryIso2: "ZA",
    city: "Cape Town",
    kind: "city",
    summary: "Mountain, ocean and winelands within an hour of each other.",
    overview:
      "Table Mountain, the Atlantic seaboard and the Cape Winelands make Cape Town one of the most varied short-haul trips from West Africa.",
    bestMonths: [11, 12, 1, 2, 3],
    days: [5, 8],
    budget: [11_000_000n, 21_000_000n, 48_000_000n],
    categories: ["city", "adventure", "family", "groups"],
    featured: true,
  },
  {
    slug: "dubai",
    name: "Dubai",
    countryIso2: "AE",
    city: "Dubai",
    kind: "city",
    summary: "Desert dunes, design-led hotels and a skyline built for night views.",
    overview:
      "A popular first international trip: short flights from Lagos and Abuja, family attractions and desert excursions.",
    bestMonths: [11, 12, 1, 2, 3],
    days: [4, 7],
    budget: [14_000_000n, 26_000_000n, 65_000_000n],
    categories: ["city", "luxury", "family", "weekend-escapes"],
    featured: true,
  },
  {
    slug: "accra",
    name: "Accra",
    countryIso2: "GH",
    city: "Accra",
    kind: "city",
    summary: "Live music, coastal forts and easy food adventures, a short hop from Lagos.",
    overview:
      "Accra is an easy weekend from Nigeria, with beach clubs, Jamestown's history and day trips to Cape Coast.",
    bestMonths: [11, 12, 1, 2, 3],
    days: [3, 5],
    budget: [6_000_000n, 11_000_000n, 25_000_000n],
    categories: ["culture", "weekend-escapes", "budget", "affordable-international", "groups"],
    featured: false,
  },
  {
    slug: "lisbon",
    name: "Lisbon",
    countryIso2: "PT",
    city: "Lisbon",
    kind: "city",
    summary: "Tiled facades, hilltop viewpoints and long lunches by the Tagus.",
    overview:
      "Lisbon rewards slow travel: walkable neighbourhoods, easy day trips to Sintra and Cascais, and good value for Western Europe.",
    bestMonths: [4, 5, 6, 9, 10],
    days: [4, 6],
    budget: [12_000_000n, 22_000_000n, 45_000_000n],
    categories: ["city", "culture", "romantic"],
    featured: false,
  },
  {
    slug: "marrakech",
    name: "Marrakech",
    countryIso2: "MA",
    city: "Marrakech",
    kind: "city",
    summary: "Riads, souks and Atlas Mountain day trips.",
    overview:
      "Stay in a riad inside the medina, explore the souks, then head to the Atlas Mountains or the Agafay desert.",
    bestMonths: [3, 4, 5, 10, 11],
    days: [4, 6],
    budget: [8_500_000n, 16_000_000n, 38_000_000n],
    categories: ["culture", "adventure", "romantic", "affordable-international"],
    featured: true,
  },
] as const;

export const cancellationPolicy = {
  key: "standard-package-cancellation",
  version: 1,
  title: "Standard package cancellation terms (DRAFT — placeholder pending legal review)",
  body: "DRAFT placeholder wording for development. Final cancellation terms must be written and approved by ORBIS management and legal counsel before launch.",
  rules: {
    tiers: [
      { minDaysBeforeDeparture: 61, penalty: { kind: "deposit" } },
      { minDaysBeforeDeparture: 30, penalty: { kind: "percent", basisPoints: 5000 } },
      { minDaysBeforeDeparture: 0, penalty: { kind: "percent", basisPoints: 10000 } },
    ],
  },
};

export const demoPackage = {
  slug: "zanzibar-stone-town-and-beach-7-days",
  title: "Zanzibar: Stone Town & North Coast",
  summary: "Two nights in historic Stone Town, then four nights on the beach at Nungwi.",
  description:
    "A relaxed first visit to Zanzibar with a guided Stone Town walk, a spice farm visit and plenty of free beach time. DEMO CONTENT — prices and availability are fictional.",
  destination: "zanzibar",
  travelStyle: "beach",
  durationDays: 7,
  nights: 6,
  dateMode: "fixed",
  bookingMode: "request",
  minPax: 1,
  maxPax: 12,
  meetingInfo: "Arrival transfer from Abeid Amani Karume International Airport (ZNZ) is included.",
  days: [
    {
      day: 1,
      title: "Arrive in Stone Town",
      overnight: "Stone Town",
      b: false,
      l: false,
      d: true,
      items: [{ kind: "transfer", title: "Airport to hotel transfer" }],
    },
    {
      day: 2,
      title: "Stone Town walking tour",
      overnight: "Stone Town",
      b: true,
      l: false,
      d: false,
      items: [
        { kind: "activity", title: "Guided heritage walk" },
        { kind: "activity", title: "Sunset dhow cruise", optional: true },
      ],
    },
    {
      day: 3,
      title: "Spice farm and transfer north",
      overnight: "Nungwi",
      b: true,
      l: true,
      d: false,
      items: [
        { kind: "activity", title: "Spice farm visit" },
        { kind: "transfer", title: "Transfer to Nungwi" },
      ],
    },
    {
      day: 4,
      title: "Beach day",
      overnight: "Nungwi",
      b: true,
      l: false,
      d: false,
      items: [{ kind: "free_time", title: "At leisure" }],
    },
    {
      day: 5,
      title: "Mnemba snorkelling (optional)",
      overnight: "Nungwi",
      b: true,
      l: false,
      d: false,
      items: [{ kind: "activity", title: "Mnemba Atoll snorkelling trip", optional: true }],
    },
    {
      day: 6,
      title: "Beach day",
      overnight: "Nungwi",
      b: true,
      l: false,
      d: true,
      items: [{ kind: "free_time", title: "At leisure" }],
    },
    {
      day: 7,
      title: "Depart",
      overnight: null,
      b: true,
      l: false,
      d: false,
      items: [{ kind: "transfer", title: "Hotel to airport transfer" }],
    },
  ],
  inclusions: [
    "6 nights' accommodation",
    "Daily breakfast",
    "Airport transfers",
    "Stone Town walking tour",
    "Spice farm visit",
  ],
  exclusions: ["International flights", "Visa fees", "Travel insurance", "Optional excursions", "Meals not listed"],
  options: [
    { kind: "room", code: "TWIN", name: "Twin / double share", basis: "per_person", occupancy: 2, required: false },
    { kind: "room", code: "SGL", name: "Single room", basis: "per_person", occupancy: 1, required: false },
    { kind: "addon", code: "DHOW", name: "Sunset dhow cruise", basis: "per_person", occupancy: null, required: false },
    {
      kind: "addon",
      code: "MNEMBA",
      name: "Mnemba snorkelling trip",
      basis: "per_person",
      occupancy: null,
      required: false,
    },
  ],
  /** Per-person prices in NGN kobo. Fictional. */
  prices: [
    { option: "TWIN", traveller: "adult", amount: 165_000_000n },
    { option: "SGL", traveller: "adult", amount: 228_000_000n },
    { option: "TWIN", traveller: "child", amount: 98_000_000n },
    { option: "DHOW", traveller: "adult", amount: 6_500_000n },
    { option: "MNEMBA", traveller: "adult", amount: 9_000_000n },
  ],
  departures: [
    { offsetDays: 45, capacity: 12 },
    { offsetDays: 90, capacity: 12 },
  ],
} as const;

export const demoStaff = [
  { role: "super_admin", name: "Demo Super Admin", title: "Administrator" },
  { role: "ops_manager", name: "Demo Operations Manager", title: "Operations" },
  { role: "booking_agent", name: "Demo Booking Agent", title: "Bookings" },
  { role: "travel_consultant", name: "Demo Travel Consultant", title: "Consulting" },
  { role: "finance_officer", name: "Demo Finance Officer", title: "Finance" },
  { role: "visa_officer", name: "Demo Visa Officer", title: "Visa services" },
  { role: "content_editor", name: "Demo Content Editor", title: "Content" },
  { role: "support_agent", name: "Demo Support Agent", title: "Support" },
] as const;

export const demoCustomer = { name: "Demo Traveller", email: "traveller@orbis.example" };

/** `.example` is a reserved TLD (RFC 2606): these addresses can never reach a real inbox. */
export const staffEmail = (role: string) => `${role.replace(/_/g, "-")}@orbis.example`;
