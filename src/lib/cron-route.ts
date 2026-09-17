import { after, type NextRequest } from "next/server";
import { isCronAuthorized, unauthorized } from "./cron-auth";

/**
 * One GET handler for every scheduled job. Supabase Cron waits only a few
 * seconds for the answer, so by default the route replies "started" at once
 * and does the work after the response (Next.js `after()`, still within the
 * route's maxDuration). `?wait=1` runs inline and returns the result, e.g.
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/sweep?wait=1"
 */
export function cronHandler(name: string, work: () => Promise<unknown>) {
  return async function GET(request: NextRequest) {
    if (!isCronAuthorized(request)) return unauthorized();
    if (request.nextUrl.searchParams.get("wait") === "1") {
      return Response.json({ ok: true, result: await work() });
    }
    after(async () => {
      try {
        await work();
      } catch (e) {
        console.error(`cron/${name} failed`, e);
      }
    });
    return Response.json({ ok: true, started: true }, { status: 202 });
  };
}
