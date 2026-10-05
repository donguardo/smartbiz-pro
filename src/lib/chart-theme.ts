import { createElement } from "react";

// Theme-aware text colours for recharts so chart labels never inherit a series colour.
// Light mode: near-black text on the white hover card. Dark mode: near-white on the dark card.
const FG = "var(--popover-foreground)";
const MUTED = "var(--muted-foreground)";

export const tooltipProps = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: FG,
    opacity: 1,
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
  },
  labelStyle: { color: FG, fontWeight: 600, margin: 0 },
  itemStyle: { color: FG, padding: 0 },
  wrapperStyle: { outline: "none", zIndex: 30 },
};

// Axis lines, tick marks and tick text all follow the theme instead of recharts' default grey.
export const axisProps = {
  stroke: MUTED,
  tick: { fill: MUTED, fontSize: 12 },
  tickLine: false,
  axisLine: false,
};

// Legend entries are rendered in the series colour by default; force the theme text colour
// and keep the coloured dot as the only series-coloured element.
export const legendProps = {
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
  formatter: (value: string | number) =>
    createElement("span", { style: { color: "var(--foreground)" } }, value),
};
