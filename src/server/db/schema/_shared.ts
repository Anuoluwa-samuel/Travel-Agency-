import { bigint, char, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "@/lib/uuid";

/** UUIDv7 primary key generated in the app (data-model §0). */
export const id = () => uuid("id").primaryKey().$defaultFn(uuidv7);

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });

/** Minor-unit money column. Always paired with a `currency` column. */
export const minor = (name: string) => bigint(name, { mode: "bigint" });
export const currency = (name = "currency") => char(name, { length: 3 });

export const tstz = (name: string) => timestamp(name, { withTimezone: true });
