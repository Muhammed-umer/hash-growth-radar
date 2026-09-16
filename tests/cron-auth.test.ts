import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron-auth";

function req(auth?: string): Request {
  return new Request("http://localhost/api/cron/collect", { headers: auth ? { authorization: auth } : {} });
}

describe("isCronAuthorized", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-value-1234567890";
  });
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("accepts the exact bearer token", () => {
    expect(isCronAuthorized(req("Bearer s3cret-value-1234567890"))).toBe(true);
  });
  it("rejects a wrong token, a token of another length, and a missing header", () => {
    expect(isCronAuthorized(req("Bearer s3cret-value-1234567891"))).toBe(false);
    expect(isCronAuthorized(req("Bearer short"))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });
  it("rejects everything when no secret is configured", () => {
    process.env.CRON_SECRET = "";
    expect(isCronAuthorized(req("Bearer "))).toBe(false);
  });
});
