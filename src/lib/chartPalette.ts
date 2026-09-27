// The ONE place chart colors are defined. Two sets — one for the light UI, one
// for the dark UI — picked with the same rules (fixed order so a series keeps
// its color, a lightness band, a chroma floor, color-blind separation, and a
// contrast check against the page background each set sits on).

// Categorical chart colors in FIXED order, checked against white.
export const CHART_COLORS = [
  "#0d9488", // teal
  "#b45309", // amber
  "#7c3aed", // violet
  "#be123c", // rose
] as const;

export const CHART_GRID = "#e7e5e4"; // stone-200
export const CHART_AXIS = "#78716c"; // stone-500

// The same four hues lifted for the dark UI, checked against stone-950
// (#0c0a09) and the stone-900 card behind most charts — every one clears
// 4.5:1 on both, so a thin 2px line stays readable.
export const CHART_COLORS_DARK = [
  "#2dd4bf", // teal-400
  "#fbbf24", // amber-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
] as const;

export const CHART_GRID_DARK = "#292524"; // stone-800
export const CHART_AXIS_DARK = "#a8a29e"; // stone-400

export type ChartTheme = {
  colors: readonly string[];
  grid: string;
  axis: string;
  /** Tooltip surface — the one bit of chart chrome that isn't a line. */
  tooltipBg: string;
  tooltipText: string;
  /** Ring drawn around the hovered point, matching the page behind it. */
  activeDotStroke: string;
};

const LIGHT: ChartTheme = {
  colors: CHART_COLORS,
  grid: CHART_GRID,
  axis: CHART_AXIS,
  tooltipBg: "#ffffff",
  tooltipText: "#1c1917", // stone-900
  activeDotStroke: "#ffffff",
};

const DARK: ChartTheme = {
  colors: CHART_COLORS_DARK,
  grid: CHART_GRID_DARK,
  axis: CHART_AXIS_DARK,
  tooltipBg: "#1c1917", // stone-900
  tooltipText: "#fafaf9", // stone-50
  activeDotStroke: "#1c1917",
};

/** Colors for the theme the visitor is actually looking at. */
export function chartTheme(mode: "light" | "dark"): ChartTheme {
  return mode === "dark" ? DARK : LIGHT;
}
