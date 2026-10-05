import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchGoals, fetchShopContext, qk } from "@/lib/store";
import { AccountSection } from "@/components/DeleteAccount";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { BusinessThemePicker } from "@/lib/theme";

export const Route = createFileRoute("/_app/settings")({ head: () => ({ meta: [{ title: "Settings — MVP BizManager" }, { name: "description", content: "Set sales goals, manage staff and your account." }, { property: "og:title", content: "Settings — MVP BizManager" }, { property: "og:description", content: "Set sales goals, manage staff and your account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { t } = useT();
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  const { data: goals = [] } = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const [values, setValues] = useState<Record<string, string>>({});
  const save = async (period: "daily" | "weekly" | "monthly") => {
    const amount = Number(values[period] ?? goals.find((g) => g.period === period)?.target_amount ?? 0);
    if (!shop || amount <= 0) { toast.error("Enter a target above ₱0"); return; }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from("sales_goals").upsert({ shop_id: shop.shop_id, period, target_amount: amount, created_by: user.user.id }, { onConflict: "shop_id,period" });
    if (error) toast.error(error.message); else { toast.success("Sales goal saved"); qc.invalidateQueries({ queryKey: qk.goals }); }
  };
  return <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8"><div><h1 className="text-3xl font-bold">{t("app.nav.settings")}</h1>{shop?.member_role === "owner" && <p className="text-muted-foreground">Set targets for {shop?.shop_name}.</p>}</div><section className="rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold">{t("theme.title")}</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">{t("theme.description")}</p><BusinessThemePicker /></section>{shop?.member_role === "owner" && <><section className="rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold">Sales goals</h2><p className="mt-1 text-sm text-muted-foreground">Weeks run Monday to Sunday. Dates follow Manila time.</p><div className="mt-5 grid gap-4 sm:grid-cols-3">{(["daily", "weekly", "monthly"] as const).map((period) => <div key={period}><label className="text-sm font-medium capitalize">{period} target</label><div className="mt-1 flex gap-2"><span className="self-center">₱</span><input inputMode="decimal" value={values[period] ?? String(goals.find((g) => g.period === period)?.target_amount ?? "")} onChange={(e) => setValues((v) => ({ ...v, [period]: e.target.value }))} placeholder="5,000" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2" /></div><Button className="mt-2 w-full" onClick={() => save(period)}>Save</Button></div>)}</div></section><Staff /></>}<AccountSection /></div>;
}

function Staff() {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["shop-members"], queryFn: async () => { const { data, error } = await supabase.from("shop_members").select("*").order("created_at"); if (error) throw error; return data; } });
  const { data: invites = [] } = useQuery({ queryKey: ["shop-invites"], queryFn: async () => { const { data, error } = await supabase.from("shop_invites").select("*").is("used_at", null).order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const [email, setEmail] = useState("");
  const invite = async () => { const { data, error } = await supabase.rpc("create_shop_invite", { _email: email }); if (error) { toast.error(error.message); return; } const row = data[0]; if (!row) return; const link = `${window.location.origin}/invite?code=${row.code}`; await navigator.clipboard.writeText(link); setEmail(""); toast.success("Invite link copied"); qc.invalidateQueries({ queryKey: ["shop-invites"] }); };
  return <section className="rounded-lg border border-border bg-card p-5"><h2 className="text-lg font-bold">Staff</h2><p className="mt-1 text-sm text-muted-foreground">Invite a cashier, then share the copied link by Messenger or Viber.</p><div className="mt-4 flex gap-2"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cashier@email.com" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2"/><Button onClick={invite}>Copy invite link</Button></div><ul className="mt-4 divide-y divide-border">{members.map((m) => <li key={m.id} className="flex items-center justify-between py-3 text-sm"><span>{m.user_id.slice(0, 8)}… <b className="ml-2 capitalize">{m.role}</b></span>{m.role === "cashier" && <Button variant="outline" size="sm" onClick={async () => { await supabase.rpc("remove_shop_cashier", { _member_id: m.id }); qc.invalidateQueries({ queryKey: ["shop-members"] }); }}>Remove</Button>}</li>)}</ul>{invites.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{invites.length} active invite{invites.length === 1 ? "" : "s"}; each expires after 48 hours.</p>}</section>;
}