"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// The list is for finding people. These two actions are the only things a
// page can change: clear a card as "approached" or "skipped". Collection and
// tagging happen only on the schedule.
// ---------------------------------------------------------------------------

/** Not a fit, or not interested. Hidden from the list. */
export async function skipItem(id: string): Promise<void> {
  await requireUser();
  const res = await db().from("items").update({ status: "skipped" }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}

/**
 * You reached out to this person yourself. Nothing about what you said is
 * stored; the item just leaves the list and counts as "approached".
 * (Kept in the database under the status name "posted".)
 */
export async function markApproached(id: string): Promise<void> {
  await requireUser();
  const res = await db().from("items").update({ status: "posted" }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}
