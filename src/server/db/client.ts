import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

/*
 * One pooled connection per server process. In development, Next.js hot reload re-evaluates
 * modules, so the client is cached on globalThis to avoid exhausting connections.
 */
const globalForDb = globalThis as unknown as { __orbisSql?: postgres.Sql };

const sql =
  globalForDb.__orbisSql ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (env.NODE_ENV !== "production") globalForDb.__orbisSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
