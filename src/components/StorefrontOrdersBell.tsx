import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Owner-only in-app alert for new online storefront orders. Polls and toasts on arrivals. */
export function StorefrontOrdersBell({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["storefront-orders-new"],
    queryFn: async () => {
      const { data, error } = await supabase.from("storefront_orders").select("id, order_no, customer_name, total, created_at").eq("status", "new").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
    refetchInterval: 45000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current) {
      const fresh = orders.filter((o) => !seen.current!.has(o.id));
      if (fresh.length === 1) toast.success(`New online order from ${fresh[0]!.customer_name} · ₱${Number(fresh[0]!.total).toLocaleString("en-PH")}`);
      else if (fresh.length > 1) toast.success(`${fresh.length} new online orders`);
      if (fresh.length && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        new Notification("New online order", { body: `${fresh.length} new order(s) in your storefront`, icon: "/icon-192.png" });
      }
    }
    seen.current = ids;
  }, [orders]);

  const toggle = () => {
    setOpen((o) => !o);
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  };

  return (
    <div className={`relative ${className}`}>
      <button onClick={toggle} aria-label={`Online orders (${orders.length} new)`} aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border">
        <ShoppingBag className="h-4 w-4" />
        {orders.length > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">{orders.length > 9 ? "9+" : orders.length}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Online orders" className="absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-1.5rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl md:left-0 md:right-auto md:bottom-11 md:mt-0">
          <div className="flex items-center justify-between"><p className="font-semibold">New online orders</p><button aria-label="Close" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
          {orders.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No new orders right now.</p> : (
            <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto">
              {orders.map((o) => (
                <li key={o.id} className="py-2 text-sm"><b>#{o.order_no} · {o.customer_name}</b>
                  <span className="block text-xs text-muted-foreground">₱{Number(o.total).toLocaleString("en-PH")} · {new Date(o.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></li>
              ))}
            </ul>
          )}
          <Link to="/store-builder" onClick={() => setOpen(false)} className="mt-2 block text-center text-sm font-semibold text-primary underline">Manage orders</Link>
        </div>
      )}
    </div>
  );
}
