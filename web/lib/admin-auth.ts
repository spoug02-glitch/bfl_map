import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options?: { N?: number },
) => Promise<Buffer>;

/** Node의 scrypt 기본 비용 파라미터(N=16384, r=8, p=1)를 그대로 쓴다. 나중에
 * 올리더라도 해시 문자열 안의 N만 보고 검증하므로 기존 비밀번호가 깨지지 않는다. */
const SCRYPT_N = 16384;
const KEY_LEN = 64;

/** Format: "scrypt:<N>:<salt_hex>:<hash_hex>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${SCRYPT_N}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const [, nRaw, saltHex, hashHex] = parts;
  const n = Number(nRaw);
  if (!Number.isInteger(n) || n <= 0) return false;
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex)) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await scrypt(password, salt, expected.length, { N: n });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** 아이디는 가입·로그인 모두 이 기준으로 비교한다. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
