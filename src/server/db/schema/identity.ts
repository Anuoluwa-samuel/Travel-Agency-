import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, timestamps, tstz } from "./_shared";

/*
 * Identity & Access (data-model §1).
 * `users`, `sessions`, `accounts`, `verifications` and `two_factors` follow the field names
 * Better Auth expects (property names, not column names). Extra columns have defaults so the
 * auth library can insert rows without knowing about them.
 */

export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    phone: text("phone"),
    phoneVerifiedAt: tstz("phone_verified_at"),
    locale: text("locale").notNull().default("en-NG"),
    timezone: text("timezone").notNull().default("Africa/Lagos"),
    status: userStatus("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: tstz("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: tstz("access_token_expires_at"),
    refreshTokenExpiresAt: tstz("refresh_token_expires_at"),
    scope: text("scope"),
    /** Better Auth stores a scrypt hash here; never a plaintext password. */
    password: text("password"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("accounts_provider_uq").on(t.providerId, t.accountId), index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tstz("expires_at").notNull(),
    ...timestamps(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: tstz("locked_until"),
    createdAt: createdAt(),
  },
  (t) => [index("two_factors_user_idx").on(t.userId), index("two_factors_secret_idx").on(t.secret)],
);

export const customerProfiles = pgTable("customer_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredCurrency: currency("preferred_currency").notNull().default("NGN"),
  homeCity: text("home_city"),
  nationality: text("nationality"),
  travelInterests: text("travel_interests")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  marketingConsentAt: tstz("marketing_consent_at"),
  whatsappConsentAt: tstz("whatsapp_consent_at"),
  assignedStaffId: uuid("assigned_staff_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
});

export const staffProfiles = pgTable("staff_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  jobTitle: text("job_title"),
  department: text("department"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
});

export const roles = pgTable("roles", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  ...timestamps(),
});

export const permissions = pgTable("permissions", {
  id: id(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  createdAt: createdAt(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const staffRoles = pgTable(
  "staff_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    grantedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("staff_roles_role_idx").on(t.roleId)],
);

/** Better Auth's database-backed rate limiter (sign-in, sign-up, password reset, 2FA). */
export const authRateLimits = pgTable("auth_rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
