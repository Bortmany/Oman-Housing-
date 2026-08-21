"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type Theme,
} from "./theme";

// ---------------------------------------------------------------------------
// Light / dark / system, hand-rolled (no new dependency).
//
// The <html> `dark` class is the single source of truth on the page: the
// pre-paint script in the layout sets it before anything is drawn, and this
// provider keeps it in step afterwards. React reads that DOM state through
// useSyncExternalStore, which is the one hook that is allowed to differ
// between the server render and the browser — so there is no hydration
// warning and no flash of the wrong colors.
// ---------------------------------------------------------------------------

type ResolvedTheme = "light" | "dark";

let listeners: Array<() => void> = [];

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
}

function emit() {
  for (const l of listeners) l();
}

function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "dark" || raw === "system" ? raw : DEFAULT_THEME;
  } catch {
    // Storage blocked (private mode, strict browser settings) — behave as if
    // nothing was ever saved rather than breaking the page.
    return DEFAULT_THEME;
  }
}

function readAppliedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function prefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

/** Put the chosen setting on <html> and tell every subscriber it changed. */
function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  emit();
}

// The server has no browser storage, so it always renders the default look;
// the browser corrects it right after hydration.
const serverTheme = () => DEFAULT_THEME;
const serverResolved = (): ResolvedTheme => "light";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, serverTheme);
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    readAppliedTheme,
    serverResolved,
  );

  useEffect(() => {
    // Self-heal if the pre-paint script was blocked, then follow the device
    // setting for as long as "System" is the choice.
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Can't remember the choice — still apply it for this visit.
    }
    applyTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Current setting + the light/dark it resolves to. Outside the provider (a
 * test, a stray render) it reports the default look instead of throwing —
 * a color preference is never worth crashing a page over.
 */
export function useTheme(): ThemeContextValue {
  return (
    useContext(ThemeContext) ?? {
      theme: DEFAULT_THEME,
      resolvedTheme: "light",
      setTheme: () => {},
    }
  );
}
