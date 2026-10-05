import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CircleCheck, Info, Percent, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { axisProps, tooltipProps } from "@/lib/chart-theme";
import { peso, pesoShort } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { BusinessScenario } from "@/lib/showcase-scenarios";

const COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHAPE = [0.78, 0.86, 0.91, 0.96, 1.11, 1.36, 1.02];

export function ShowcaseDashboard({ scenario }: { scenario: BusinessScenario }) {
  const { lang, t } = useT();
  const [cats, setCats] = useState(() => scenario.categories.map((category) => ({ ...category })));
  const [growth, setGrowth] = useState(scenario.growth);
  const [averageTicket, setAverageTicket] = useState(scenario.averageTicket);
  const text = <T extends { en: string; tl: string }>(value: T) => value[lang];
  const totals = useMemo(() => {
    const baseRevenue = cats.reduce((sum, category) => sum + category.sales, 0);
    const revenue = baseRevenue * (1 + growth / 100);
    const profit = cats.reduce((sum, category) => sum + category.sales * (category.margin / 100), 0) * (1 + growth / 100);
    return { revenue, profit, margin: revenue ? (profit / revenue) * 100 : 0, orders: Math.round(revenue / Math.max(averageTicket, 1)) };
  }, [averageTicket, cats, growth]);
  const weekly = useMemo(() => {
    const base = totals.revenue / SHAPE.reduce((sum, value) => sum + value, 0);
    return DAYS.map((day, index) => ({ day, sales: Math.round(base * SHAPE[index]!), previous: Math.round((base * SHAPE[index]!) / (1 + growth / 100)) }));
  }, [growth, totals.revenue]);
  const reset = () => {
    setCats(scenario.categories.map((category) => ({ ...category })));
    setGrowth(scenario.growth);
    setAverageTicket(scenario.averageTicket);
  };
  const update = (index: number, field: "sales" | "margin", value: number) => setCats((current) => current.map((category, position) => position === index ? { ...category, [field]: value } : category));
  const goal = Math.ceil(totals.revenue / 10000) * 10000;
  const metrics = [
    { label: t("dash.salesWeek"), value: peso(totals.revenue), icon: Wallet },
    { label: t("dash.profit"), value: peso(totals.profit), icon: TrendingUp },
    { label: t("dash.profitHundred"), value: peso(totals.margin), icon: Percent },
    { label: t("dash.salesCount"), value: totals.orders.toLocaleString(), icon: ReceiptText },
  ];

  return (
    <div data-business-theme={scenario.theme} className="showcase-theme rounded-lg bg-background text-foreground">
      <div className="grid gap-4 xl:grid-cols-[310px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase text-muted-foreground">{t("showcase.edit")}</p>
            <Button variant="ghost" size="sm" onClick={reset}>{t("showcase.reset")}</Button>
          </div>
          <div className="mt-4 space-y-4">
            {cats.map((category, index) => (
              <div key={category.name.en} className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />{text(category.name)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted-foreground">{t("showcase.sales")}
                    <input type="number" min={0} step={500} value={category.sales} onChange={(event) => update(index, "sales", Math.max(0, Number(event.target.value)))} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 font-mono text-sm text-foreground" />
                  </label>
                  <label className="text-xs text-muted-foreground">{t("showcase.margin")}
                    <input type="number" min={0} max={100} value={category.margin} onChange={(event) => update(index, "margin", Math.min(100, Math.max(0, Number(event.target.value))))} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 font-mono text-sm text-foreground" />
                  </label>
                </div>
              </div>
            ))}
            <label className="block text-xs text-muted-foreground">{t("showcase.growth")}: <b className="text-foreground">{growth}%</b>
              <input type="range" min={-30} max={50} value={growth} onChange={(event) => setGrowth(Number(event.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
            </label>
            <label className="block text-xs text-muted-foreground">{t("showcase.ticket")}: <b className="text-foreground">{peso(averageTicket)}</b>
              <input type="range" min={50} max={1500} step={5} value={averageTicket} onChange={(event) => setAverageTicket(Number(event.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
            </label>
          </div>
        </aside>

        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-sm text-muted-foreground">{scenario.sampleName}</p><h2 className="text-xl font-bold">{growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% {growth >= 0 ? t("dash.summaryUp") : t("dash.summaryDown")} · {text(scenario.tagline)}</h2></div>
            <scenario.icon className="h-9 w-9 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => <div key={metric.label} className="rounded-lg border border-border bg-background p-4"><metric.icon className="h-4 w-4 text-primary" /><p className="mt-3 text-xs text-muted-foreground">{metric.label}</p><p className="text-xl font-bold tabular-nums md:text-2xl">{metric.value}</p></div>)}
          </div>
          <div className="rounded-lg border border-border bg-background p-4"><div className="flex justify-between gap-4 text-sm"><b>{t("showcase.weeklyGoal")}</b><span>{peso(totals.revenue)} / {peso(goal)}</span></div><Progress value={(totals.revenue / goal) * 100} className="mt-3" /></div>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border border-border bg-background p-4"><h3 className="text-sm font-semibold">{t("showcase.salesTrend")}</h3><div className="mt-3 h-60"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekly}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="day" {...axisProps} /><YAxis {...axisProps} tickFormatter={pesoShort} width={50} /><Tooltip formatter={(value: number) => peso(value)} {...tooltipProps} /><Area type="monotone" dataKey="previous" stroke="var(--muted-foreground)" strokeDasharray="4 4" fill="transparent" isAnimationActive={false} /><Area type="monotone" dataKey="sales" stroke="var(--chart-1)" strokeWidth={3} fill="var(--accent)" fillOpacity={0.45} /></AreaChart></ResponsiveContainer></div></div>
            <div className="rounded-lg border border-border bg-background p-4"><h3 className="text-sm font-semibold">{t("showcase.salesMix")}</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={cats} dataKey="sales" nameKey="name.en" innerRadius={45} outerRadius={72} paddingAngle={3} stroke="none">{cats.map((category, index) => <Cell key={category.name.en} fill={COLORS[index]} />)}</Pie><Tooltip formatter={(value: number) => peso(value)} {...tooltipProps} /></PieChart></ResponsiveContainer></div><ul className="space-y-1 text-xs">{cats.map((category, index) => <li key={category.name.en} className="flex justify-between gap-3"><span className="truncate"><i className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />{text(category.name)}</span><b>{Math.round((category.sales / Math.max(1, cats.reduce((sum, item) => sum + item.sales, 0))) * 100)}%</b></li>)}</ul></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{scenario.alerts.map((alert) => { const Icon = alert.level === "warning" ? AlertTriangle : alert.level === "success" ? CircleCheck : Info; return <div key={alert.text.en} className="flex gap-3 rounded-lg border border-border bg-background p-4"><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${alert.level === "warning" ? "text-warning" : alert.level === "success" ? "text-success" : "text-primary"}`} /><p className="text-sm">{text(alert.text)}</p></div>; })}</div>
        </div>
      </div>
    </div>
  );
}