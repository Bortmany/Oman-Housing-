"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-admin";
import { getFreeLaunchInfo, setFreeLaunch } from "@/lib/siteSettings";

export type FreeLaunchState =
  | { status: "saved"; on: boolean; changedAt: string }
  | { status: "tooMany" }
  | { status: "error" }
  | null;

const schema = z.object({ value: z.enum(["on", "off"]) });

/** Switch the free launch period on or off. Admin only (house rule 7). */
export async function saveFreeLaunch(
  _prev: FreeLaunchState,
  formData: FormData,
): Promise<FreeLaunchState> {
  const session = await requireAdmin();
  if (!session) return { status: "error" };

  // Same per-admin limiter as the other admin actions (120/min).
  const limit = checkRateLimit(`admin:user:${session.user.id}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return { status: "tooMany" };

  const parsed = schema.safeParse({ value: formData.get("value") });
  if (!parsed.success) return { status: "error" };

  await setFreeLaunch(parsed.data.value === "on");
  // Every public and agency page reads the switch, so refresh them all.
  revalidatePath("/", "layout");

  // Read back from the database path (cache was just refreshed).
  const info = await getFreeLaunchInfo();
  return {
    status: "saved",
    on: info.on,
    changedAt: info.changedAt ?? new Date().toISOString(),
  };
}
