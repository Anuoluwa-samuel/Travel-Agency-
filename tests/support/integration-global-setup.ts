import { config } from "dotenv";
import postgres from "postgres";
import { runMigrations } from "../../src/server/db/migrate";

/** Drops and recreates the public schema of the TEST database, then applies all migrations. */
export default async function setup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  if (!/orbis_test/.test(url)) throw new Error(`Refusing to reset a database that doesn't look like a test DB: ${url}`);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
  );
  await sql.end();
  await runMigrations(url);
}
