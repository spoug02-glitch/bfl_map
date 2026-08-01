import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
const ddl = readFileSync(new URL("../schema.sql", import.meta.url), "utf-8");
for (const stmt of ddl.split(";").map(s => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}
const [{ count }] = await sql`SELECT count(*)::int AS count FROM reviews`;
console.log("reviews table ready, rows:", count);
