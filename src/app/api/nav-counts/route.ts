import { requireUser } from "@/lib/auth";
import { navCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** The navbar badges, asked for again after every page change (src/components/nav-links.tsx). */
export async function GET() {
  await requireUser();
  const counts = await navCounts();
  return Response.json(counts, { headers: { "Cache-Control": "no-store" } });
}
