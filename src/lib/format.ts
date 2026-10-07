export const peso = (n: number) =>
  "₱" + (Number.isFinite(n) ? n : 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pesoShort = (n: number) =>
  n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : `₱${Math.round(n)}`;

export const PLAN_PRICES = { basic: 499, standard: 999, pro: 1499 } as const;
