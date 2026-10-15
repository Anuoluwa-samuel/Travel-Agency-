import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db/client";
import { roles, staffProfiles, staffRoles } from "@/server/db/schema";
import { AppError, forbidden, unauthenticated } from "@/server/lib/errors";
import { auth } from "./auth";
import { type Permission, ROLES_REQUIRING_2FA, permissionsForRoles } from "./permissions";

/*
 * Data Access Layer for identity (ARCHITECTURE.md §8). Every service entry point calls one of
 * these. They throw AppError; pages translate UNAUTHENTICATED into a redirect to sign-in.
 *
 * These read request headers, so with Cache Components they must run inside a <Suspense>
 * boundary or a server action, never at the top level of a layout.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: string;
}

export interface StaffContext {
  user: SessionUser;
  roles: string[];
  permissions: ReadonlySet<Permission>;
}

/** Current session or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { twoFactorEnabled?: boolean | null; status?: string };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    status: u.status ?? "active",
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  if (user.status !== "active") throw new AppError("FORBIDDEN", "This account is not active. Please contact support.");
  return user;
}

/** Role keys for an active staff member; empty for customers and deactivated staff. */
export const getStaffRoles = cache(async (userId: string): Promise<string[]> => {
  const rows = await db
    .select({ key: roles.key, active: staffProfiles.isActive })
    .from(staffRoles)
    .innerJoin(roles, eq(roles.id, staffRoles.roleId))
    .innerJoin(staffProfiles, eq(staffProfiles.userId, staffRoles.userId))
    .where(eq(staffRoles.userId, userId));
  return rows.filter((r) => r.active).map((r) => r.key);
});

export async function getStaffContext(): Promise<StaffContext | null> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return null;
  const roleKeys = await getStaffRoles(user.id);
  if (roleKeys.length === 0) return null;
  return { user, roles: roleKeys, permissions: permissionsForRoles(roleKeys) };
}

export class TwoFactorRequiredError extends AppError {
  constructor() {
    super("FORBIDDEN", "Two-factor authentication is required for your role. Please enable it to continue.", {
      reason: "2fa_required",
    });
  }
}

/**
 * Staff gate. With a permission, also checks it. Privileged roles must have 2FA enabled
 * (ADR-006) before any admin access.
 */
export async function requireStaff(permission?: Permission): Promise<StaffContext> {
  const user = await requireUser();
  const roleKeys = await getStaffRoles(user.id);
  if (roleKeys.length === 0) throw forbidden();
  if (!user.twoFactorEnabled && roleKeys.some((r) => (ROLES_REQUIRING_2FA as readonly string[]).includes(r))) {
    throw new TwoFactorRequiredError();
  }
  const ctx: StaffContext = { user, roles: roleKeys, permissions: permissionsForRoles(roleKeys) };
  if (permission) assertPermission(ctx, permission);
  return ctx;
}

export function hasPermission(ctx: Pick<StaffContext, "permissions"> | null, permission: Permission): boolean {
  return Boolean(ctx?.permissions.has(permission));
}

export function assertPermission(ctx: Pick<StaffContext, "permissions">, permission: Permission): void {
  if (!ctx.permissions.has(permission)) throw forbidden();
}
