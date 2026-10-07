import { useState } from "react";
import { Printer, ReceiptText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";
import { useShopProfile } from "@/lib/shop-profile";
import type { Sale, SaleItem } from "@/lib/store";
import "@/receipt-print.css";

export function OwnerSalesHistory({ sales, items, shopId }: { sales: Sale[]; items: SaleItem[]; shopId: string }) {
  const { t, lang } = useT();
  const { data: business } = useShopProfile(shopId);
  const [selected, setSelected] = useState<Sale | null>(null);
  const date = (at: string) => new Date(at).toLocaleString(lang === "tl" ? "fil-PH" : "en-PH");
  const synced = (sale: Sale) => sale.synced_at ? <p className="text-xs text-muted-foreground">{t("offline.saleSyncedAt", { at: date(sale.synced_at) })}</p> : null;
  return <section className="border-t border-border pt-5">
    <h2 className="font-bold">{t("sales.history")}</h2>
    {!sales.length && <p className="mt-3 text-sm text-muted-foreground">{t("sales.empty")}</p>}
    <ul className="mt-3 max-h-96 divide-y divide-border overflow-y-auto">
      {sales.map((sale) => <li key={sale.id} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{sale.receipt_no} · {peso(Number(sale.total))}</p><p className="text-xs text-muted-foreground">{date(sale.created_at)}</p>{synced(sale)}</div>
        <Button variant="ghost" size="icon" title={t("sales.receipt")} aria-label={`${t("sales.receipt")} ${sale.receipt_no}`} onClick={() => setSelected(sale)}><ReceiptText className="h-4 w-4" /></Button>
      </li>)}
    </ul>
    {selected && <div role="dialog" aria-modal="true" aria-label={t("sales.receipt")} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 print:static print:bg-transparent">
      <div className="w-full max-w-sm">
        <div id="receipt" className="max-h-[75vh] overflow-y-auto rounded-lg bg-card p-6 font-mono text-sm text-card-foreground print:max-h-none print:overflow-visible">
          {business?.logoSrc && <img src={business.logoSrc} alt={t("profile.logo")} className="mx-auto mb-3 h-20 w-20 object-contain" />}
          <p className="break-words text-center font-bold">{business?.name}</p>
          <p className="text-center text-xs text-muted-foreground">{date(selected.created_at)}</p>
          <div className="text-center">{synced(selected)}</div>
          <p className="text-center text-xs">{t("sales.receipt")} {selected.receipt_no}</p>
          <div className="my-3 border-t border-dashed border-border" />
          {items.filter((item) => item.sale_id === selected.id).map((item) => <div key={item.id} className="flex justify-between gap-3 py-1"><span className="min-w-0 break-words">{item.name} ×{Number(item.quantity ?? item.qty)}</span><span className="shrink-0">{peso(Number(item.price) * Number(item.quantity ?? item.qty))}</span></div>)}
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold"><span>{selected.payment_method === "ewallet" ? "GCash" : selected.payment_method}</span><span>{peso(Number(selected.total))}</span></div>
        </div>
        <div className="mt-3 flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={async () => { if (business?.logoSrc) { const img = document.querySelector<HTMLImageElement>("#receipt img"); await img?.decode().catch(() => undefined); } window.print(); }}><Printer className="h-4 w-4" />{t("sales.print")}</Button>
          <Button onClick={() => setSelected(null)}><X className="h-4 w-4" />{t("sales.close")}</Button>
        </div>
      </div>
    </div>}
  </section>;
}