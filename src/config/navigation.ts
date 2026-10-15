/**
 * Navigation structure from docs/journeys.md §3.
 *
 * `live: false` items are planned but not built yet. They are hidden instead of rendered as
 * dead links (RULES.md §6: no button without a real action). Flip the flag as each phase ships.
 */
export interface NavItem {
  label: string;
  href: string;
  description?: string;
  live: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const primaryNav: (NavItem | NavGroup)[] = [
  { label: "Destinations", href: "/destinations", live: true },
  { label: "Packages", href: "/packages", live: true },
  { label: "Flights", href: "/flights", live: true },
  { label: "Hotels", href: "/hotels", live: true },
  {
    label: "Plan a trip",
    items: [
      {
        label: "AI trip planner",
        href: "/plan",
        description: "A day-by-day proposal from your preferences",
        live: false,
      },
      { label: "Budget calculator", href: "/budget", description: "Estimate the full cost of a trip", live: false },
      { label: "Group trips", href: "/group-trips", description: "Plan, vote and split costs together", live: false },
      { label: "Visa readiness", href: "/visa", description: "Checklists and document help", live: false },
    ],
  },
  { label: "Guides", href: "/guides", live: true },
  { label: "Contact", href: "/contact", live: true },
];

export const footerNav: NavGroup[] = [
  {
    label: "Travel",
    items: [
      { label: "Destinations", href: "/destinations", live: true },
      { label: "Packages", href: "/packages", live: true },
      { label: "Flights", href: "/flights", live: true },
      { label: "Hotels", href: "/hotels", live: true },
      { label: "Guides", href: "/guides", live: true },
      { label: "Consultations", href: "/consultations", live: true },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "AI trip planner", href: "/plan", live: false },
      { label: "Budget calculator", href: "/budget", live: false },
      { label: "Group trips", href: "/group-trips", live: false },
      { label: "Visa readiness", href: "/visa", live: false },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Find a booking", href: "/booking/lookup", live: false },
      { label: "Contact us", href: "/contact", live: true },
      { label: "Your account", href: "/account", live: true },
    ],
  },
  {
    label: "Legal",
    items: [
      { label: "Terms", href: "/legal/terms", live: false },
      { label: "Privacy", href: "/legal/privacy", live: false },
      { label: "Cookies", href: "/legal/cookies", live: false },
    ],
  },
];

export const isGroup = (item: NavItem | NavGroup): item is NavGroup => "items" in item;

/** Removes unbuilt links and empty groups. */
export function liveOnly<T extends NavItem | NavGroup>(items: T[]): T[] {
  return items
    .map((item) => (isGroup(item) ? ({ ...item, items: item.items.filter((i) => i.live) } as T) : item))
    .filter((item) => (isGroup(item) ? item.items.length > 0 : item.live));
}
