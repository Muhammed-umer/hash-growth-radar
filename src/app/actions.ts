"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// The list is for finding people. "Skip" is the only thing a page can change:
// it hides a card you have dealt with or do not want. Collection and tagging
// happen only on the schedule.
// ---------------------------------------------------------------------------

/** Not a fit, or not interested. Hidden from the list. */
export async function skipItem(id: string): Promise<void> {
  await requireUser();
  const res = await db().from("items").update({ status: "skipped" }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}
