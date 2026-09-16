import "server-only";

/**
 * Login is intentionally absent for now (the founder's decision, Sep 2026).
 * Every page and server action still calls requireUser(), so when a password
 * gate is added later it only needs to be implemented here: read a signed
 * cookie, compare against an APP_PASSWORD env var, and throw or redirect when
 * it is missing. The cron routes are protected separately by CRON_SECRET.
 */
export async function requireUser(): Promise<string> {
  return "team";
}
