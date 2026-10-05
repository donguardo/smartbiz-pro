import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, PackageX } from "lucide-react";
import { computeInsights, fetchItems, fetchProducts, fetchShopContext, qk } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_app/copilot")({
  head: () => ({ meta: [
    { title: "AI Manager — MVP BizManager" },
    { name: "description", content: "Proactive inventory insights for your store." },
    { property: "og:title", content: "AI Manager — MVP BizManager" },
    { property: "og:description", content: "Proactive inventory insights for your store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Copilot,
});

function Copilot() {
  const { t } = useT();
  const { data: products = [] } = useQuery({ queryKey: qk.products, queryFn: fetchProducts });
  const { data: items = [] } = useQuery({ queryKey: qk.items, queryFn: fetchItems });
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const insights = useMemo(() => computeInsights(products, items), [products, items]);
  if (shop?.member_role === "cashier") return <div className="mx-auto max-w-3xl p-4 md:p-8"><div className="rounded-lg border border-border bg-card p-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-6 w-6 text-primary"/>Ask BIZBOT</h1><p className="mt-2 text-sm text-muted-foreground">Ask about stock levels, product prices, or how to record a sale. Cost and profit reports stay private to the owner.</p><Button className="mt-5" onClick={() => window.dispatchEvent(new Event("open-bizbot"))}><Bot/>Open BIZBOT</Button></div></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Bot className="h-7 w-7 text-primary" /> AI Manager</h1>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary/20 p-4 backdrop-blur-md">
        <p className="max-w-xl text-sm text-muted-foreground">{t("bot.welcomeBody")}</p>
        <Button onClick={() => window.dispatchEvent(new Event("open-bizbot"))}><Bot /> {t("bot.open")}</Button>
      </div>
      <ul className="space-y-3">
        {insights.length === 0 && <li className="rounded-2xl border border-border bg-card p-4 text-muted-foreground">No stock issues right now.</li>}
        {insights.map((i, k) => (
          <li key={k} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            {i.kind === "reorder" ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <PackageX className="h-5 w-5 shrink-0 text-destructive" />}
            <div><p className="font-semibold">{i.title}</p><p className="text-sm text-muted-foreground">{i.detail}</p></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
