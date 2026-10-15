/**
 * Permission catalogue and default role grants. Source of truth for RULES.md §5; the seed
 * writes these into `permissions`, `roles` and `role_permissions`. Changing a grant here needs
 * a re-seed (idempotent) and an entry in MEMORY.md.
 */

export const PERMISSIONS = {
  "booking.read": "View bookings",
  "booking.update_status": "Change booking status",
  "booking.assign": "Assign bookings to staff",
  "enquiry.manage": "Work enquiries",
  "customer.read": "View customer profiles",
  "customer.export": "Export customer data",
  "catalogue.edit": "Edit destinations and packages",
  "catalogue.publish": "Publish destinations and packages",
  "pricing.edit": "Edit prices, fees and payment plans",
  "supplier.manage": "Manage suppliers and inventory",
  "finance.read": "View payments, invoices and reports",
  "finance.refund": "Approve and issue refunds",
  "finance.reconcile": "Run payment reconciliation",
  "visa.manage": "Manage visa cases",
  "document.read_private": "Open private customer documents",
  "consultation.manage": "Manage consultations",
  "content.manage": "Manage guides, pages and homepage",
  "support.manage": "Handle support tickets",
  "analytics.read": "View analytics",
  "staff.manage": "Manage staff accounts and roles",
  "settings.manage": "Change business settings",
  "audit.read": "View the audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLES = {
  super_admin: { name: "Super administrator", permissions: ALL_PERMISSIONS },
  ops_manager: {
    name: "Operations manager",
    permissions: [
      "booking.read",
      "booking.update_status",
      "booking.assign",
      "enquiry.manage",
      "customer.read",
      "customer.export",
      "catalogue.edit",
      "catalogue.publish",
      "pricing.edit",
      "supplier.manage",
      "finance.read",
      "visa.manage",
      "consultation.manage",
      "content.manage",
      "support.manage",
      "analytics.read",
      "audit.read",
    ],
  },
  booking_agent: {
    name: "Booking agent",
    permissions: [
      "booking.read",
      "booking.update_status",
      "enquiry.manage",
      "customer.read",
      "supplier.manage",
      "support.manage",
    ],
  },
  travel_consultant: {
    name: "Travel consultant",
    permissions: [
      "booking.read",
      "booking.update_status",
      "enquiry.manage",
      "customer.read",
      "consultation.manage",
      "support.manage",
    ],
  },
  finance_officer: {
    name: "Finance officer",
    permissions: [
      "booking.read",
      "customer.read",
      "pricing.edit",
      "finance.read",
      "finance.refund",
      "finance.reconcile",
      "analytics.read",
    ],
  },
  visa_officer: {
    name: "Visa case officer",
    permissions: ["customer.read", "visa.manage", "document.read_private", "consultation.manage", "support.manage"],
  },
  content_editor: {
    name: "Content editor",
    permissions: ["catalogue.edit", "catalogue.publish", "content.manage"],
  },
  support_agent: {
    name: "Customer support agent",
    permissions: ["booking.read", "enquiry.manage", "customer.read", "consultation.manage", "support.manage"],
  },
} as const satisfies Record<string, { name: string; permissions: readonly Permission[] }>;

export type RoleKey = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

/** Roles that must have two-factor authentication enabled before using the admin area. */
export const ROLES_REQUIRING_2FA: readonly RoleKey[] = [
  "super_admin",
  "ops_manager",
  "finance_officer",
  "visa_officer",
];

export function permissionsForRoles(roles: readonly string[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) {
    const role = ROLES[r as RoleKey];
    if (!role) continue;
    for (const p of role.permissions) out.add(p);
  }
  return out;
}
