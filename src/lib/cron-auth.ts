import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Supabase Cron (supabase/migrations/0002_cron.sql) sends
 * `Authorization: Bearer <CRON_SECRET>` when it calls a cron route. The same
 * header lets you trigger a route by hand with curl. Compared in constant time.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = env("CRON_SECRET");
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}
