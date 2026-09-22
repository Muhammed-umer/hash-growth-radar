"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// The list is for finding people. The only thing a page can change is whether
// a comment is still waiting to be looked at. "Mark as read" moves it to the
// Read page (status "skipped" in the database, a name kept so old rows stay
// valid); "Move back" returns it. Whether anyone approached the person is
// never recorded. Collection and tagging happen only on the schedule.
// ---------------------------------------------------------------------------

/** Moves a listed comment to the Read page and notes when. */
export async function markRead(id: string): Promise<void> {
  await requireUser();
  const cur = await db().from("items").select("meta").eq("id", id).single();
  if (cur.error) throw new Error(cur.error.message);
  const meta = { ...((cur.data?.meta as Record<string, unknown> | null) ?? {}), read_at: new Date().toISOString() };
  const res = await db().from("items").update({ status: "skipped", meta }).eq("id", id).eq("status", "tagged");
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}

/** Puts a read comment back on the list. */
export async function markUnread(id: string): Promise<void> {
  await requireUser();
  const res = await db().from("items").update({ status: "tagged" }).eq("id", id).eq("status", "skipped");
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}
