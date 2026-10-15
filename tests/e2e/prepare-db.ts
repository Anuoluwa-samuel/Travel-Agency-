/**
 * Recreates the E2E database from scratch: drop schema → migrate → seed fictional data.
 * Runs as the first step of Playwright's webServer command, because Playwright starts the web
 * server before any globalSetup, and the server needs the database to exist.
 */
import postgres from "postgres";
import { runMigrations } from "../../src/server/db/migrate";
import { seed } from "../../src/server/db/seed";

async function prepare() {
  const url = process.env.E2E_DATABASE_URL!;
  const dbName = new URL(url).pathname.slice(1);
  if (!/e2e/.test(dbName)) throw new Error(`Refusing to reset "${dbName}": E2E database names must contain "e2e"`);

  const admin = postgres(url.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1"), { max: 1, onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists) await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
  );
  await sql.end();

  await runMigrations(url);
  process.env.SEED_DEMO_PASSWORD = process.env.E2E_SEED_PASSWORD;
  await seed(url);
}

prepare()
  .then(() => console.log("E2E database ready."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
