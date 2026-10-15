import type { Permission } from "@/server/auth/permissions";

/**
 * Admin sidebar from journeys.md §3. Each entry declares the permission that unlocks it; the
 * layout filters by the signed-in staff member's permissions. `live: false` entries are hidden
 * until their phase ships (no dead links).
 */
export interface AdminNavItem {
  href: string;
  label: string;
  permission: Permission | null;
  live: boolean;
}

export const adminNav: { group: string; items: AdminNavItem[] }[] = [
  {
    group: "Operations",
    items: [
      { href: "/admin", label: "Overview", permission: null, live: true },
      { href: "/admin/bookings", label: "Bookings", permission: "booking.read", live: false },
      { href: "/admin/enquiries", label: "Enquiries", permission: "enquiry.manage", live: false },
      { href: "/admin/customers", label: "Customers", permission: "customer.read", live: false },
      { href: "/admin/consultations", label: "Consultations", permission: "consultation.manage", live: false },
      { href: "/admin/support", label: "Support", permission: "support.manage", live: false },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { href: "/admin/destinations", label: "Destinations", permission: "catalogue.edit", live: false },
      { href: "/admin/packages", label: "Packages", permission: "catalogue.edit", live: false },
      { href: "/admin/pricing", label: "Pricing", permission: "pricing.edit", live: false },
      { href: "/admin/suppliers", label: "Suppliers", permission: "supplier.manage", live: false },
    ],
  },
  {
    group: "Services",
    items: [
      { href: "/admin/finance", label: "Finance", permission: "finance.read", live: false },
      { href: "/admin/visa", label: "Visa cases", permission: "visa.manage", live: false },
      { href: "/admin/content", label: "Content", permission: "content.manage", live: false },
      { href: "/admin/analytics", label: "Analytics", permission: "analytics.read", live: false },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/admin/staff", label: "Staff & roles", permission: "staff.manage", live: false },
      { href: "/admin/audit", label: "Audit log", permission: "audit.read", live: false },
      { href: "/admin/settings", label: "Settings", permission: "settings.manage", live: false },
    ],
  },
];

export function visibleAdminNav(permissions: ReadonlySet<Permission>) {
  return adminNav
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.live && (i.permission === null || permissions.has(i.permission))),
    }))
    .filter((g) => g.items.length > 0);
}
