// The shared facts about the light/dark setting — imported by both the server
// layout (for the pre-paint script) and the client provider, so the key and the
// allowed values are written down exactly once.

export const THEME_STORAGE_KEY = "oman-theme";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

/** Missing or unreadable choice = light, the app's original look. */
export const DEFAULT_THEME: Theme = "light";

export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in the page <head> BEFORE the browser paints anything, so a visitor who
 * chose dark never sees a white flash while React loads. It only adds/removes
 * the `dark` class on <html>; everything else is CSS. Wrapped in try/catch
 * because localStorage throws in private-mode / storage-blocked browsers, and a
 * theme preference must never break the page.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=t==="dark"||(t==="system"&&window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
