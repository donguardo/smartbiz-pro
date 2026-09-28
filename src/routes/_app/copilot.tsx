import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, PackageX } from "lucide-react";
import { computeInsights, fetchItems, fetchProducts, qk } from "@/lib/store";

export const Route = createFileRoute("/_app/copilot")({
  head: () => ({ meta: [
    { title: "AI Manager — BizManager.ai | MAS KITA, MAS TUBO!" },
    { name: "description", content: "Proactive inventory insights for your store." },
    { property: "og:title", content: "AI Manager — BizManager.ai | MAS KITA, MAS TUBO!" },
    { property: "og:description", content: "Proactive inventory insights for your store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Copilot,
});

function Copilot() {
  const { data: products = [] } = useQuery({ queryKey: qk.products, queryFn: fetchProducts });
  const { data: items = [] } = useQuery({ queryKey: qk.items, queryFn: fetchItems });
  const insights = useMemo(() => computeInsights(products, items), [products, items]);
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Bot className="h-7 w-7 text-primary" /> AI Manager</h1>
      <p className="text-muted-foreground">Reorder alerts and dead-stock warnings from your latest sales. Chat is coming next.</p>
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
