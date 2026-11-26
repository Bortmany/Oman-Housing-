// The "colour spreads from the button" theme switch.
//
// Pressing the Appearance pill takes a picture of the page, flips the theme,
// then shows the NEW look inside a circle that grows from the spot that was
// pressed (keyboard press: from the pill's centre) until it covers the whole
// screen — 500 ms, ease-in-out. The old look does not fade.
//
// Instant switch, no animation, when the browser has no View Transitions
// (older Firefox / Safari) or the visitor asked for reduced motion.
// `apply` MUST change the page synchronously — the browser takes its "after"
// picture as soon as it returns.

export const REVEAL_DURATION_MS = 500;

/**
 * Where the circle starts and how big it must end, as CSS `circle()` values.
 * `circle(N%)` is a percentage of sqrt((w² + h²) / 2), so the farthest-corner
 * distance is converted into that unit. Pure — tested in theme-reveal.test.ts.
 */
export function revealCircle(x: number, y: number, w: number, h: number) {
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  const pct = (radius / (Math.hypot(w, h) / Math.SQRT2)) * 100;
  const at = `at ${(x / w) * 100}% ${(y / h) * 100}%`;
  return { from: `circle(0% ${at})`, to: `circle(${pct}% ${at})`, radius };
}

type PressEvent = {
  detail: number;
  clientX: number;
  clientY: number;
  currentTarget: EventTarget | null;
};

/** Mouse/touch: the real press point. Keyboard (detail 0): the button's centre. */
export function revealOrigin(e: PressEvent): [number, number] {
  if (e.detail > 0) return [e.clientX, e.clientY];
  const el = e.currentTarget as Element | null;
  if (!el || typeof el.getBoundingClientRect !== "function") {
    return [window.innerWidth / 2, window.innerHeight / 2];
  }
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

/** True when the switch should be instant (no API, or reduced motion asked for). */
export function revealUnavailable(doc: Document, win: Window): boolean {
  return (
    typeof doc.startViewTransition !== "function" ||
    win.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

let current: ViewTransition | null = null;

/**
 * Run `apply` with the growing-circle reveal. `changesLook` false (e.g. Dark →
 * System on a dark device: only the label changes) applies with no animation.
 */
export function switchThemeWithReveal(
  e: PressEvent,
  apply: () => void,
  changesLook = true,
): void {
  if (!changesLook || revealUnavailable(document, window)) {
    apply();
    return;
  }
  const [x, y] = revealOrigin(e);
  const { from, to } = revealCircle(x, y, window.innerWidth, window.innerHeight);
  const root = document.documentElement;
  root.dataset.themeReveal = "";
  const t = document.startViewTransition(apply);
  current = t;
  const done = () => {
    if (current === t) {
      delete root.dataset.themeReveal;
      current = null;
    }
  };
  t.finished.then(done, done);
  t.ready.then(
    () => {
      root.animate(
        { clipPath: [from, to] },
        {
          duration: REVEAL_DURATION_MS,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    },
    () => {},
  );
}
