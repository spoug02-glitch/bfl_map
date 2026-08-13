import { neon } from "@neondatabase/serverless";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { config } from "dotenv";

config({ path: ".env.local" });

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 16384;
const KEY_LEN = 64;

// lib/admin-auth.ts의 hashPassword와 같은 포맷을 낸다. 이 스크립트는 Next.js
// 빌드를 거치지 않는 순수 Node ESM이라 TS 파일을 직접 import할 수 없어 복제한다.
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${SCRYPT_N}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

const username = process.env.SEED_ADMIN_USERNAME;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!username || !password) {
  console.error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set.");
  process.exit(1);
}
if (username.trim().length < 3) {
  console.error("SEED_ADMIN_USERNAME must be at least 3 characters.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const [existing] = await sql`
  SELECT id FROM admin_users WHERE lower(trim(username)) = lower(trim(${username}))`;
if (existing) {
  console.error(`admin_users row already exists for "${username}" (id=${existing.id}).`);
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const [row] = await sql`
  INSERT INTO admin_users (username, password_hash, role)
  VALUES (${username}, ${passwordHash}, 'super_admin')
  RETURNING id`;
console.log(`super_admin created: id=${row.id}, username=${username}`);
