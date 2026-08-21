"use client";

import { useTranslations } from "next-intl";
import { THEMES, type Theme } from "./theme";
import { useTheme } from "./ThemeProvider";

// One small pill in the header, styled like the language switcher next to it.
// Each click moves to the next setting: Light → Dark → System → Light.
const GLYPHS: Record<Theme, string> = {
  light: "☀",
  dark: "☾",
  system: "◐",
};

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();

  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800"
      aria-label={`${t("label")}: ${t(theme)}`}
      title={t("switchTo", { mode: t(next) })}
    >
      <span aria-hidden="true">{GLYPHS[theme]}</span>
      <span className="hidden sm:inline">{t(theme)}</span>
    </button>
  );
}
