import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tstz, updatedAt } from "./_shared";
import { users } from "./identity";

/*
 * Platform (data-model §14). `audit_logs` is append-only: a trigger in the migration rejects
 * UPDATE and DELETE.
 */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    // No ON DELETE action: users are anonymised, never hard-deleted, and the append-only
    // trigger would reject a SET NULL cascade anyway.
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorRoles: text("actor_roles").array(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** Redacted snapshots; never raw personal documents or secrets. */
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Generic replay store: a repeated request with the same key returns the stored response. */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response"),
    createdAt: createdAt(),
    expiresAt: tstz("expires_at").notNull(),
  },
  (t) => [index("idempotency_keys_expires_idx").on(t.expiresAt)],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    id: id(),
    key: text("key").notNull(),
    windowStart: tstz("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("rate_limit_buckets_key_window_uq").on(t.key, t.windowStart)],
);
