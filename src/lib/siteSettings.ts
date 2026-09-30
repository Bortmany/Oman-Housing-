import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBoolSetting } from "@/lib/siteSettingsCore";

// ---------------------------------------------------------------------------
// Owner-flipped site switches, stored in the small SiteSetting table
// (key / value text / updatedAt). A missing row means "use the default", so no
// seed is needed. Reads come from ONE cached snapshot of the whole table
// (tiny) and the snapshot is refreshed the moment a setting is written.
//
// Adding a setting later (e.g. Step 6 plan prices): add a key to SETTING_KEYS
// and a typed getter below. No schema change needed — it's all just rows.
// ---------------------------------------------------------------------------

export const SETTINGS_CACHE_TAG = "site-settings";

/** Every key the app knows about. */
export const SETTING_KEYS = {
  freeLaunch: "free_launch",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

type Snapshot = Record<string, { value: string; updatedAt: string }>;

const cachedSnapshot = unstable_cache(
  async (): Promise<Snapshot> => {
    const rows = await prisma.siteSetting.findMany();
    const out: Snapshot = {};
    for (const r of rows) {
      out[r.key] = { value: r.value, updatedAt: r.updatedAt.toISOString() };
    }
    return out;
  },
  ["site-settings-snapshot"],
  { revalidate: 300, tags: [SETTINGS_CACHE_TAG] },
);

/** Raw text value of a setting, or null when it has never been written. */
export async function getSetting(key: SettingKey): Promise<string | null> {
  return (await cachedSnapshot())[key]?.value ?? null;
}

/** A yes/no setting; `fallback` when the row is missing or unreadable. */
export async function getBoolSetting(key: SettingKey, fallback: boolean): Promise<boolean> {
  return parseBoolSetting(await getSetting(key), fallback);
}

/** Write a setting and refresh the cached snapshot straight away. */
export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  updateTag(SETTINGS_CACHE_TAG);
}

// ---------- Typed getters ----------

/** Free launch period: ON unless the owner has switched it off. */
export async function getFreeLaunch(): Promise<boolean> {
  return getBoolSetting(SETTING_KEYS.freeLaunch, true);
}

/** The switch plus when it was last changed (null = never changed). */
export async function getFreeLaunchInfo(): Promise<{ on: boolean; changedAt: string | null }> {
  const row = (await cachedSnapshot())[SETTING_KEYS.freeLaunch];
  return {
    on: parseBoolSetting(row?.value ?? null, true),
    changedAt: row?.updatedAt ?? null,
  };
}

export async function setFreeLaunch(on: boolean): Promise<void> {
  await setSetting(SETTING_KEYS.freeLaunch, on ? "true" : "false");
}
