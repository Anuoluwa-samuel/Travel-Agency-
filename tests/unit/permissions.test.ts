import { describe, expect, it } from "vitest";
import { visibleAdminNav } from "@/config/admin-nav";
import { canAccess } from "@/server/auth/access";
import { ALL_PERMISSIONS, ROLES, ROLES_REQUIRING_2FA, permissionsForRoles } from "@/server/auth/permissions";

describe("role grants match RULES.md §5", () => {
  it("gives super admin every permission", () => {
    expect(permissionsForRoles(["super_admin"]).size).toBe(ALL_PERMISSIONS.length);
  });

  it("keeps finance actions away from booking agents and consultants", () => {
    for (const role of ["booking_agent", "travel_consultant", "support_agent", "content_editor", "visa_officer"]) {
      const p = permissionsForRoles([role]);
      expect(p.has("finance.refund"), role).toBe(false);
      expect(p.has("finance.reconcile"), role).toBe(false);
      expect(p.has("finance.read"), role).toBe(false);
    }
  });

  it("restricts private documents to super admin and visa officers", () => {
    const holders = Object.entries(ROLES)
      .filter(([, r]) => (r.permissions as readonly string[]).includes("document.read_private"))
      .map(([k]) => k)
      .sort();
    expect(holders).toEqual(["super_admin", "visa_officer"]);
  });

  it("restricts staff and settings management to super admin", () => {
    for (const perm of ["staff.manage", "settings.manage"] as const) {
      const holders = Object.entries(ROLES).filter(([, r]) => (r.permissions as readonly string[]).includes(perm));
      expect(holders.map(([k]) => k)).toEqual(["super_admin"]);
    }
  });

  it("unions permissions across roles and ignores unknown roles", () => {
    const p = permissionsForRoles(["content_editor", "finance_officer", "nope"]);
    expect(p.has("content.manage")).toBe(true);
    expect(p.has("finance.refund")).toBe(true);
    expect(p.has("visa.manage")).toBe(false);
  });

  it("requires 2FA for the privileged roles", () => {
    expect([...ROLES_REQUIRING_2FA].sort()).toEqual(["finance_officer", "ops_manager", "super_admin", "visa_officer"]);
  });
});

describe("canAccess (IDOR guard)", () => {
  const owner = "00000000-0000-7000-8000-000000000001";
  const other = "00000000-0000-7000-8000-000000000002";
  const staff = "00000000-0000-7000-8000-000000000003";

  it("lets owners in", () => {
    expect(canAccess({ userId: owner }, { ownerUserId: owner }, { staffPermission: "booking.read" })).toBe(true);
  });

  it("keeps other customers out", () => {
    expect(canAccess({ userId: other }, { ownerUserId: owner }, { staffPermission: "booking.read" })).toBe(false);
  });

  it("does not treat a null owner as matching", () => {
    expect(canAccess({ userId: other }, { ownerUserId: null }, { staffPermission: "booking.read" })).toBe(false);
  });

  it("lets staff in only with the permission", () => {
    const withPerm = { userId: staff, permissions: permissionsForRoles(["booking_agent"]) };
    const withoutPerm = { userId: staff, permissions: permissionsForRoles(["content_editor"]) };
    expect(canAccess(withPerm, { ownerUserId: owner }, { staffPermission: "booking.read" })).toBe(true);
    expect(canAccess(withoutPerm, { ownerUserId: owner }, { staffPermission: "booking.read" })).toBe(false);
  });

  it("enforces assigned-only scoping", () => {
    const actor = { userId: staff, permissions: permissionsForRoles(["booking_agent"]) };
    const opts = { staffPermission: "booking.read" as const, assignedOnly: true };
    expect(canAccess(actor, { ownerUserId: owner, assignedStaffId: staff }, opts)).toBe(true);
    expect(canAccess(actor, { ownerUserId: owner, assignedStaffId: other }, opts)).toBe(false);
  });
});

describe("admin navigation", () => {
  it("only shows live items the role may open", () => {
    const groups = visibleAdminNav(permissionsForRoles(["content_editor"]));
    const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/admin");
    expect(hrefs).not.toContain("/admin/finance");
  });
});
