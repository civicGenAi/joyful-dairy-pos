/**
 * Applies every SQL file in supabase/migrations/ in filename order.
 *
 * Usage:  SUPABASE_DB_URL=postgresql://... bun scripts/db-push.ts
 * (Find the connection string in Supabase: Project Settings -> Database.
 *  Put it in .env.local, which bun loads automatically.)
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add it to .env.local and retry.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const dir = join(import.meta.dir, "..", "supabase", "migrations");

await sql`
  create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const applied = new Set(
  (await sql`select name from public._migrations`).map((r) => r.name as string),
);

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip   ${file} (already applied)`);
    continue;
  }
  console.log(`apply  ${file}`);
  const body = await readFile(join(dir, file), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`insert into public._migrations (name) values (${file})`;
  });
}

await sql.end();
console.log("done");
