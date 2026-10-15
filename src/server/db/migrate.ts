/**
 * Applies pending migrations. Usage:
 *   pnpm db:migrate            (DATABASE_URL from .env.local)
 *   DATABASE_URL=... pnpm db:migrate
 * Runs outside Next.js, so it reads env directly instead of importing src/server/env.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { pathToFileURL } from "node:url";

config({ path: ".env.local", quiet: true });

export async function runMigrations(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "src/server/db/migrations" });
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log("Migrations applied."))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
