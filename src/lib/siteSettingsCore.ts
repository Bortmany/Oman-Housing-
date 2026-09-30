// Pure helpers for site settings (no I/O) — tested in siteSettings.test.ts.

/** Read a stored yes/no value. Missing or unrecognised text gives `fallback`. */
export function parseBoolSetting(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}
