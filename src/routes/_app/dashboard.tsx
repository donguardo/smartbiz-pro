import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Bot, PackageX, Percent, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { computeInsights, fetchItems, fetchProducts, fetchSales, loadSampleData, qk } from "@/lib/store";
import { peso, pesoShort } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — MVP BizManager.ai" },
    { name: "description", content: "Revenue, margins and AI insights for your store." },
    { property: "og:title", content: "Dashboard — MVP BizManager.ai" },
    { property: "og:description", content: "Revenue, margins and AI insights for your store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" };

function Dashboard() {
  const qc = useQueryClient();
  const [range, setRange] = useState<7 | 30>(7);
  const [seeding, setSeeding] = useState(false);
  const products = useQuery({ queryKey: qk.products, queryFn: fetchProducts });
  const sales = useQuery({ queryKey: qk.sales, queryFn: fetchSales });
  const items = useQuery({ queryKey: qk.items, queryFn: fetchItems });

  const d = useMemo(() => {
    const S = sales.data ?? [], I = items.data ?? [];
    const now = Date.now(), from = now - range * 86400000, prevFrom = from - range * 86400000;
    const cur = S.filter((s) => new Date(s.created_at).getTime() >= from);
    const prev = S.filter((s) => { const t = new Date(s.created_at).getTime(); return t >= prevFrom && t < from; });
    const rev = cur.reduce((a, s) => a + Number(s.total), 0);
    const prevRev = prev.reduce((a, s) => a + Number(s.total), 0);
    const cost = cur.reduce((a, s) => a + Number(s.cost_total), 0);
    const days = Array.from({ length: range }, (_, i) => {
      const day = new Date(now - (range - 1 - i) * 86400000);
      const key = day.toDateString();
      const v = cur.filter((s) => new Date(s.created_at).toDateString() === key);
      return { day: day.toLocaleDateString("en-PH", { month: "short", day: "numeric" }), revenue: v.reduce((a, s) => a + Number(s.total), 0), profit: v.reduce((a, s) => a + Number(s.total) - Number(s.cost_total), 0) };
    });
    const curItems = I.filter((i) => new Date(i.created_at).getTime() >= from);
    const byCat = new Map<string, { sales: number; profit: number }>();
    for (const i of curItems) {
      const c = byCat.get(i.category) ?? { sales: 0, profit: 0 };
      c.sales += Number(i.price) * i.qty; c.profit += (Number(i.price) - Number(i.cost)) * i.qty;
      byCat.set(i.category, c);
    }
    const cats = [...byCat.entries()].map(([name, v]) => ({ name, ...v, margin: v.sales ? Math.round((v.profit / v.sales) * 100) : 0 }));
    const byProd = new Map<string, number>();
    for (const i of curItems) byProd.set(i.name, (byProd.get(i.name) ?? 0) + Number(i.price) * i.qty);
    const top = [...byProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
    const methods = ["cash", "ewallet", "card"].map((m) => ({ name: m === "ewallet" ? "E-wallet/QR" : m.charAt(0).toUpperCase() + m.slice(1), value: cur.filter((s) => s.payment_method === m).reduce((a, s) => a + Number(s.total), 0) }));
    return { rev, prevRev, profit: rev - cost, orders: cur.length, days, cats, top, methods };
  }, [sales.data, items.data, range]);

  const insights = useMemo(() => computeInsights(products.data ?? [], items.data ?? []), [products.data, items.data]);
  const change = d.prevRev ? ((d.rev - d.prevRev) / d.prevRev) * 100 : 0;

  const seed = async () => {
    setSeeding(true);
    try { await loadSampleData(); await qc.invalidateQueries(); toast.success("Sample store loaded"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load sample data"); }
    finally { setSeeding(false); }
  };

  if (products.isLoading || sales.isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  if ((products.data ?? []).length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-12">
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <h1 className="text-3xl font-bold">Let's set up your store</h1>
          <p className="mt-2 text-muted-foreground">Add your own products, or load a sample store with 3 weeks of sales to explore every feature.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={seed} disabled={seeding} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-60">{seeding ? "Loading sample store…" : "Load sample store"}</button>
            <Link to="/inventory" className="rounded-lg border border-border px-5 py-2.5 font-semibold hover:bg-muted">Add my products</Link>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Revenue", value: peso(d.rev), sub: `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% vs prior ${range}d`, icon: Wallet, tone: change >= 0 ? "text-success" : "text-destructive" },
    { label: "Gross profit", value: peso(d.profit), sub: "after cost of goods", icon: TrendingUp, tone: "text-muted-foreground" },
    { label: "Margin", value: `${d.rev ? ((d.profit / d.rev) * 100).toFixed(1) : "0"}%`, sub: "blended", icon: Percent, tone: "text-muted-foreground" },
    { label: "Transactions", value: d.orders.toString(), sub: `avg ${peso(d.orders ? d.rev / d.orders : 0)}`, icon: ShoppingBag, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Overview</p>
          <h1 className="text-3xl font-bold">Store performance</h1>
        </div>
        <div className="flex rounded-lg border border-border bg-card p-1 text-sm">
          {([7, 30] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1.5 ${range === r ? "bg-primary text-primary-foreground" : ""}`}>{r} days</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{c.label}</p><c.icon className="h-4 w-4 text-primary" /></div>
            <p className="mt-2 font-display text-xl font-semibold tabular-nums md:text-2xl">{c.value}</p>
            <p className={`mt-1 text-xs ${c.tone}`}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Revenue & profit</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.days}>
                <defs>
                  <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={pesoShort} width={48} />
                <Tooltip formatter={(v: number) => peso(v)} contentStyle={tip} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#rv)" />
                <Area type="monotone" dataKey="profit" stroke="var(--chart-2)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-ink p-5 text-ink-foreground">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70"><Bot className="h-4 w-4" /> AI Manager insights</p>
            <Link to="/copilot" className="text-xs text-primary">Ask more →</Link>
          </div>
          <ul className="mt-4 max-h-64 space-y-3 overflow-auto pr-1">
            {insights.length === 0 && <li className="text-sm opacity-70">All good — no stock issues right now.</li>}
            {insights.slice(0, 6).map((i, k) => (
              <li key={k} className="flex gap-3 rounded-xl bg-ink-foreground/5 p-3">
                {i.kind === "reorder" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <PackageX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <div><p className="text-sm font-semibold">{i.title}</p><p className="text-xs opacity-70">{i.detail}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Sales by category</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.cats} dataKey="sales" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3} stroke="none">
                  {d.cats.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => peso(v)} contentStyle={tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-xs">
            {d.cats.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % 5] }} />{c.name}</span>
                <span className="font-mono text-muted-foreground">{c.margin}% margin</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Margin by category</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.cats} dataKey="profit" nameKey="name" outerRadius={85} stroke="var(--card)" strokeWidth={2}>
                  {d.cats.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => peso(v)} contentStyle={tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Top products</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.top} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => peso(v)} contentStyle={tip} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {d.methods.map((m) => (
          <div key={m.name} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <span className="text-sm text-muted-foreground">{m.name}</span>
            <span className="font-display font-semibold">{peso(m.value)}</span>
          </div>
        ))}
      </div>

      <Link to="/pos" className="flex items-center justify-between rounded-2xl bg-primary p-5 text-primary-foreground">
        <span className="font-display text-lg font-semibold">Open the register</span><ArrowRight className="h-5 w-5" />
      </Link>
    </div>
  );
}
