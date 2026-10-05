import { UNITS, isDecimalUnit, type Unit } from "@/lib/store";

export const CSV_COLUMNS = ["name", "category", "price", "cost", "unit", "track_stock", "stock", "reorder_at", "sku"] as const;

export const SAMPLE_CSV = [
  CSV_COLUMNS.join(","),
  "Sticker,School supplies,25,15,pc,yes,100,10,STK-001",
  "Haircut,Services,120,,service,no,,,",
  "Rice,Grains,52,45,kg,yes,50,10,RICE-KG",
].join("\n");

export type CsvProduct = { name: string; category: string; price: number; cost: number | null; unit: Unit; track_stock: boolean; stock_qty: number; reorder_level: number; sku: string };
export type CsvRow = { line: number; data?: CsvProduct | undefined; errors: string[] };

function splitLine(line: string) {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseProductCsv(text: string, existingSkus: Set<string>): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = splitLine(lines[0]!).map((h) => h.toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  if (idx("name") < 0 || idx("price") < 0) return [{ line: 1, errors: ["Header must include at least name and price"] }];
  const seen = new Set<string>();
  return lines.slice(1).map((l, i) => {
    const cells = splitLine(l); const get = (k: string) => (idx(k) >= 0 ? cells[idx(k)] ?? "" : "");
    const errors: string[] = [];
    const name = get("name"); if (!name) errors.push("Name is required");
    const price = Number(get("price")); if (get("price") === "" || !Number.isFinite(price) || price < 0) errors.push("Price must be a number ≥ 0");
    const cost = get("cost") === "" ? null : Number(get("cost")); if (cost != null && (!Number.isFinite(cost) || cost < 0)) errors.push("Cost must be a number ≥ 0");
    const unit = (get("unit") || "pc") as Unit; if (!UNITS.includes(unit)) errors.push(`Unit must be one of ${UNITS.join(", ")}`);
    const ts = get("track_stock").toLowerCase();
    const track = unit === "service" ? false : !["no", "false", "0", "n"].includes(ts);
    const stock = get("stock") === "" ? 0 : Number(get("stock"));
    if (track && (!Number.isFinite(stock) || stock < 0)) errors.push("Stock must be a number ≥ 0");
    if (track && !isDecimalUnit(unit) && !Number.isInteger(stock)) errors.push("Decimals only for kg, g or L");
    const reorder = get("reorder_at") === "" ? 5 : Number(get("reorder_at")); if (!Number.isFinite(reorder) || reorder < 0) errors.push("reorder_at must be a number ≥ 0");
    const sku = get("sku"); const key = sku.toLowerCase();
    if (sku && (existingSkus.has(key) || seen.has(key))) errors.push(`SKU ${sku} already used`);
    if (sku) seen.add(key);
    return { line: i + 2, errors, data: errors.length ? undefined : { name, category: get("category") || "General", price, cost, unit, track_stock: track, stock_qty: track ? stock : 0, reorder_level: Math.round(reorder), sku } };
  });
}
