import { notFound } from "@/server/lib/errors";
import type { Permission } from "./permissions";

/**
 * Resource-level access (IDOR protection, RULES.md §4). Pure so it can be unit-tested.
 *
 * Customers may access a resource only if they own it. Staff need the given permission, and,
 * when `assignedOnly` scoping is on, must be the assigned staff member.
 *
 * Failures throw NOT_FOUND rather than FORBIDDEN so callers can't probe which ids exist.
 */
export interface AccessActor {
  userId: string;
  permissions?: ReadonlySet<Permission>;
}

export interface OwnedResource {
  ownerUserId: string | null;
  assignedStaffId?: string | null;
}

export function canAccess(
  actor: AccessActor,
  resource: OwnedResource,
  opts: { staffPermission: Permission; assignedOnly?: boolean },
): boolean {
  if (resource.ownerUserId !== null && resource.ownerUserId === actor.userId) return true;
  if (!actor.permissions?.has(opts.staffPermission)) return false;
  if (opts.assignedOnly) return resource.assignedStaffId === actor.userId;
  return true;
}

export function assertCanAccess(
  actor: AccessActor,
  resource: OwnedResource | null | undefined,
  opts: { staffPermission: Permission; assignedOnly?: boolean; label?: string },
): asserts resource is OwnedResource {
  if (!resource || !canAccess(actor, resource, opts)) throw notFound(opts.label);
}
