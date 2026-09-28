import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { peso, pesoShort } from "@/lib/format";
import { TrendingUp, ShoppingBag, Percent, Wallet } from "lucide-react";

type Cat = { name: string; sales: number; margin: number };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHAPE = [0.78, 0.84, 0.9, 0.95, 1.12, 1.35, 1.06];

export function DemoDashboard() {
  const [cats, setCats] = useState<Cat[]>([
    { name: "Beverages", sales: 42000, margin: 32 },
    { name: "Snacks", sales: 28500, margin: 38 },
    { name: "Household", sales: 19800, margin: 24 },
    { name: "Personal care", sales: 15200, margin: 41 },
  ]);
  const [growth, setGrowth] = useState(8);
  const [avgTicket, setAvgTicket] = useState(185);

  const totals = useMemo(() => {
    const revenue = cats.reduce((s, c) => s + c.sales, 0);
    const profit = cats.reduce((s, c) => s + (c.sales * c.margin) / 100, 0);
    return { revenue, profit, margin: revenue ? (profit / revenue) * 100 : 0, orders: Math.round(revenue / Math.max(avgTicket, 1)) };
  }, [cats, avgTicket]);

  const weekly = useMemo(() => {
    const base = totals.revenue / SHAPE.reduce((a, b) => a + b, 0);
    return DAYS.map((d, i) => ({
      day: d,
      thisWeek: Math.round(base * SHAPE[i]! * (1 + growth / 100)),
      lastWeek: Math.round(base * SHAPE[i]!),
    }));
  }, [totals.revenue, growth]);

  const update = (i: number, key: "sales" | "margin", v: number) =>
    setCats((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: v } : c)));

  const metrics = [
    { label: "Weekly revenue", value: peso(totals.revenue * (1 + growth / 100)), icon: Wallet },
    { label: "Gross profit", value: peso(totals.profit * (1 + growth / 100)), icon: TrendingUp },
    { label: "Blended margin", value: `${totals.margin.toFixed(1)}%`, icon: Percent },
    { label: "Transactions", value: totals.orders.toLocaleString(), icon: ShoppingBag },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-primary/50 bg-primary/40 p-5 backdrop-blur-md">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Try it — edit the numbers</p>
        <div className="mt-4 space-y-4">
          {cats.map((c, i) => (
            <div key={c.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  {c.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Sales ₱
                  <input type="number" value={c.sales} min={0} step={500}
                    onChange={(e) => update(i, "sales", Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
                </label>
                <label className="text-xs text-muted-foreground">
                  Margin %
                  <input type="number" value={c.margin} min={0} max={100}
                    onChange={(e) => update(i, "margin", Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
                </label>
              </div>
            </div>
          ))}
          <label className="block text-xs text-muted-foreground">
            Week-over-week growth: <span className="font-mono text-foreground">{growth}%</span>
            <input type="range" min={-30} max={50} value={growth} onChange={(e) => setGrowth(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
          </label>
          <label className="block text-xs text-muted-foreground">
            Average ticket: <span className="font-mono text-foreground">{peso(avgTicket)}</span>
            <input type="range" min={50} max={1000} step={5} value={avgTicket} onChange={(e) => setAvgTicket(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-primary/50 bg-primary/40 p-4 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-4">
              <m.icon className="h-4 w-4 text-primary" />
              <p className="mt-3 text-xs text-muted-foreground">{m.label}</p>
              <p className="font-display text-lg font-semibold tabular-nums md:text-xl">{m.value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Revenue this week vs last</p>
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekly}>
                  <defs>
                    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={pesoShort} width={50} />
                  <Tooltip formatter={(v: number) => peso(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                  <Area type="monotone" dataKey="lastWeek" stroke="var(--muted-foreground)" strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
                  <Area type="monotone" dataKey="thisWeek" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#dg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Sales mix by category</p>
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats} dataKey="sales" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3} stroke="none">
                    {cats.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => peso(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
