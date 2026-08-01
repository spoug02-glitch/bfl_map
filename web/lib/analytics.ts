/**
 * Self-hosted DAU/MAU tracking (Neon Postgres, no third-party SDK).
 *
 * Client contract (implemented by whoever wires up the page):
 *   1. Read or create a random visitor id via `crypto.randomUUID()`, stored
 *      under `VISITOR_ID_STORAGE_KEY` in localStorage.
 *   2. Read the last ping time from `LAST_PING_STORAGE_KEY` in localStorage
 *      (ISO string, or null if never set).
 *   3. Call `shouldPing(lastPingIso, new Date())`. If true, POST /api/visit
 *      with `{ visitorId }`, then on success write the current time (ISO)
 *      to `LAST_PING_STORAGE_KEY`.
 *   This caps traffic to one /api/visit request per device per calendar day.
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const VISITOR_ID_STORAGE_KEY = "bfl_visitor_id";
export const LAST_PING_STORAGE_KEY = "bfl_last_visit_ping";

/** Accepts a UUID or a 16-64 char [A-Za-z0-9_-] token; rejects everything else. */
export function isValidVisitorId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return UUID_RE.test(value) || TOKEN_RE.test(value);
}

/** True when `lastPingIso` is null/unparseable, or names a calendar day before `now`. */
export function shouldPing(lastPingIso: string | null, now: Date): boolean {
  if (!lastPingIso) return true;
  const last = new Date(lastPingIso);
  if (Number.isNaN(last.getTime())) return true;
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}
