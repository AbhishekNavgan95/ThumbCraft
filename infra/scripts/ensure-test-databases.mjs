/**
 * Create wallet_test / generation_test (if missing) and apply Prisma migrations.
 * Used by `pnpm test:prepare` before Vitest. Safe to re-run.
 *
 * Usage: node infra/scripts/ensure-test-databases.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const adminUrl =
  process.env.POSTGRES_ADMIN_URL ??
  "postgresql://thumbcraft:thumbcraft@localhost:5432/postgres";

const databases = [
  {
    name: "wallet_test",
    url:
      process.env.WALLET_TEST_DATABASE_URL ??
      "postgresql://thumbcraft:thumbcraft@localhost:5432/wallet_test",
    appDir: resolve(root, "apps/wallet-service"),
  },
  {
    name: "generation_test",
    url:
      process.env.GENERATION_TEST_DATABASE_URL ??
      "postgresql://thumbcraft:thumbcraft@localhost:5432/generation_test",
    appDir: resolve(root, "apps/generation-worker"),
  },
];

async function ensureDatabase(name) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE ${name}`);
      console.log(`created database ${name}`);
    } else {
      console.log(`database ${name} already exists`);
    }
  } finally {
    await client.end();
  }
}

function migrate(appDir, databaseUrl) {
  const result = spawnSync(
    "pnpm",
    ["exec", "prisma", "migrate", "deploy"],
    {
      cwd: appDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
      shell: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed in ${appDir}`);
  }
}

for (const db of databases) {
  await ensureDatabase(db.name);
  console.log(`migrating ${db.name}…`);
  migrate(db.appDir, db.url);
}

console.log("test databases ready");
