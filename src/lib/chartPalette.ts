// Categorical chart colors in FIXED order — series keep their color no matter
// how many are shown. Validated (lightness band, chroma floor, CVD separation,
// contrast on white) with the dataviz palette validator.
export const CHART_COLORS = [
  "#0d9488", // teal
  "#b45309", // amber
  "#7c3aed", // violet
  "#be123c", // rose
] as const;

export const CHART_GRID = "#e7e5e4"; // stone-200
export const CHART_AXIS = "#78716c"; // stone-500
