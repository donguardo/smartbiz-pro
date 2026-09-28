import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeInsights, fetchItems, fetchProducts, qk, type Product } from "@/lib/store";
import { peso } from "@/lib/format";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [
    { title: "Inventory — BizManager.ai | MAS KITA, MAS TUBO!" },
    { name: "description", content: "Manage products, stock and reorder levels." },
    { property: "og:title", content: "Inventory — BizManager.ai | MAS KITA, MAS TUBO!" },
    { property: "og:description", content: "Manage products, stock and reorder levels." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Inventory,
});

type Form = { id?: string; name: string; sku: string; category: string; price: string; cost: string; stock: string; reorder_level: string };
const empty: Form = { name: "", sku: "", category: "General", price: "", cost: "", stock: "0", reorder_level: "5" };

function Inventory() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: qk.products, queryFn: fetchProducts });
  const { data: items = [] } = useQuery({ queryKey: qk.items, queryFn: fetchItems });
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState("");
  const insights = useMemo(() => computeInsights(products, items), [products, items]);
  const flag = (id: string) => insights.filter((i) => i.product?.id === id).map((i) => i.kind);
  const value = products.reduce((s, p) => s + Number(p.cost) * p.stock, 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const row = { name: form.name, sku: form.sku || `SKU-${Date.now().toString(36)}`, category: form.category || "General", price: Number(form.price), cost: Number(form.cost), stock: Number(form.stock), reorder_level: Number(form.reorder_level) };
    const { error } = form.id ? await supabase.from("products").update(row).eq("id", form.id) : await supabase.from("products").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Product updated" : "Product added");
    setForm(null);
    qc.invalidateQueries({ queryKey: qk.products });
  };
  const del = async (p: Product) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: qk.products });
  };

  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.includes(q));
  const F = (k: keyof Form, label: string, type = "text") => (
    <label className="text-xs text-muted-foreground">{label}
      <input type={type} step="any" required={k === "name" || k === "price"} value={form?.[k] ?? ""} onChange={(e) => setForm((f) => f && { ...f, [k]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
    </label>
  );

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{products.length} products · {peso(value)} at cost</p>
          <h1 className="text-3xl font-bold">Inventory</h1>
        </div>
        <button onClick={() => setForm(empty)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add product</button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or barcode" className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm md:max-w-sm" />
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Margin</th><th className="p-3 text-right">Stock</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((p) => {
              const f = flag(p.id);
              const m = Number(p.price) ? ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100 : 0;
              return (
                <tr key={p.id}>
                  <td className="p-3"><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-muted-foreground">{p.sku}</p></td>
                  <td className="p-3 text-muted-foreground">{p.category}</td>
                  <td className="p-3 text-right font-mono">{peso(Number(p.price))}</td>
                  <td className="p-3 text-right font-mono">{m.toFixed(0)}%</td>
                  <td className="p-3 text-right font-mono">{p.stock}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {f.includes("reorder") && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-foreground">Reorder</span>}
                      {f.includes("dead") && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Dead stock</span>}
                      {f.length === 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Healthy</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button aria-label="Edit" onClick={() => setForm({ id: p.id, name: p.name, sku: p.sku, category: p.category, price: String(p.price), cost: String(p.cost), stock: String(p.stock), reorder_level: String(p.reorder_level) })} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Delete" onClick={() => del(p)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-t-3xl bg-card p-6 sm:rounded-3xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{form.id ? "Edit product" : "Add product"}</h3><button type="button" onClick={() => setForm(null)}><X className="h-5 w-5" /></button></div>
            {F("name", "Name")}
            <div className="grid grid-cols-2 gap-3">{F("sku", "Barcode / SKU")}{F("category", "Category")}</div>
            <div className="grid grid-cols-2 gap-3">{F("price", "Selling price ₱", "number")}{F("cost", "Cost ₱", "number")}</div>
            <div className="grid grid-cols-2 gap-3">{F("stock", "In stock", "number")}{F("reorder_level", "Reorder at", "number")}</div>
            <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Save</button>
          </form>
        </div>
      )}
    </div>
  );
}
