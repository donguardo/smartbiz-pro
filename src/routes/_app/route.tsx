import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Download, LayoutDashboard, LogOut, Package, ScanLine, Settings, Users, BriefcaseBusiness, ClipboardList, CreditCard, Hammer } from "lucide-react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle, syncThemeFromAccount } from "@/lib/theme";
import { LanguageToggle, useT } from "@/lib/i18n";
import { StoreIdentity } from "@/components/StoreIdentity";
import { StockAlertsBell } from "@/components/StockAlerts";
import { BillingFailureAlert } from "@/components/BillingDiagnostics";
import { useShopProfile } from "@/lib/shop-profile";
import { fetchMyPlan, fetchProfile, fetchShopContext, qk } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { OfflineStatus } from "@/components/OfflineStatus";
import { clearOfflineDataFor, countOfflineSalesFor, setIntentionalSignOut, useOnline } from "@/lib/offline";
import { openInstallPrompt } from "@/lib/install";
import { offlineLocked, useBilling } from "@/lib/billing";
import { BillingPanel } from "./billing";
import { StoreSwitcher } from "@/components/StoreSwitcher";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "app.nav.dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "app.nav.pos", icon: ScanLine },
  { to: "/inventory", label: "app.nav.inventory", icon: Package },
  { to: "/copilot", label: "app.nav.copilot", icon: Bot },
] as const;

const OWNER_NAV = [
  { to: "/customers", label: "app.nav.customers", icon: Users },
  { to: "/business", label: "app.nav.business", icon: BriefcaseBusiness },
  { to: "/reorders", label: "app.nav.reorders", icon: ClipboardList },
  { to: "/billing", label: "app.nav.billing", icon: CreditCard },
] as const;
const SETTINGS_NAV = { to: "/settings", label: "app.nav.settings", icon: Settings } as const;

function AppLayout() {
  const { session, loading } = useSession();
  const { t } = useT();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  const userId = session?.user.id;
  useEffect(() => { if (userId) void syncThemeFromAccount(); }, [userId]);
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: fetchProfile, enabled: !!session });
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext, enabled: !!session, retry: 1 });
  const { data: myPlan } = useQuery({ queryKey: qk.plan, queryFn: fetchMyPlan, enabled: !!session, retry: 1 });
  const trialDays = myPlan?.on_trial && myPlan.trial_ends_at ? Math.max(0, Math.ceil((new Date(myPlan.trial_ends_at).getTime() - Date.now()) / 86400000)) : null;
  const { data: business } = useShopProfile(shop?.shop_id);
  const businessName = business?.name ?? shop?.shop_name ?? profile?.business_name ?? "…";
  const { data: billing } = useBilling(!!session && !!shop);
  const online = useOnline();
  const locked = !!billing && (navigator.onLine ? !billing.has_access : offlineLocked(billing)) && !path.startsWith("/billing") && !path.startsWith("/settings");
  const signOut = async () => {
    if (!session) return;
    if (countOfflineSalesFor(session.user.id) && !confirm(t("offline.signOutWarn"))) return;
    setIntentionalSignOut(true);
    try {
      clearOfflineDataFor(session.user.id, { includeQueue: true });
      await supabase.auth.signOut();
    } finally { setIntentionalSignOut(false); }
  };
  const visibleNav = shop?.member_role === "owner" ? [...NAV, ...OWNER_NAV, SETTINGS_NAV] : [...NAV, SETTINGS_NAV];

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("app.loading")}</div>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar p-4 backdrop-blur-xl md:flex">
        <div className="mb-4 flex items-center gap-2"><StoreIdentity name={businessName} logoSrc={business?.logoSrc} />{shop?.member_role === "owner" && <HammerLink />}</div>
        {shop?.member_role === "owner" && <StoreSwitcher className="mb-2 w-full max-w-none" />}
        <nav className="mt-2 space-y-1">
          {visibleNav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <n.icon className="h-4 w-4" />{t(n.label)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-sidebar-border px-3 py-2 text-xs"><span className="font-semibold">{shop?.member_role === "owner" ? "Owner" : shop?.member_role === "cashier" ? "Cashier" : "…"}</span><span className="block truncate text-muted-foreground">{session.user.email}</span></div>
          <Button variant="outline" className="w-full" onClick={openInstallPrompt}>
            <Download className="h-4 w-4" />{t("install.open")}
          </Button>
          <LanguageToggle className="w-full justify-center" />
          <div className="rounded-xl border border-sidebar-border p-3 text-xs text-muted-foreground">
            {t("app.plan")}: <span className="font-semibold text-foreground">{!myPlan ? "…" : trialDays !== null ? t("plan.trialSidebar", { label: myPlan.label, n: String(trialDays) }) : t("plan.sidebar", { label: myPlan.label, price: myPlan.monthly_price_php.toLocaleString("en-PH") })}</span>
          </div>
          <div className="flex items-center gap-2">
            {shop?.member_role === "owner" && <StockAlertsBell />}
            <ThemeToggle />
            <button onClick={signOut} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border text-sm hover:bg-muted">
              <LogOut className="h-4 w-4" /> {t("app.signOut")}
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-3 pt-2 pb-2 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center">
          <StoreIdentity name={businessName} logoSrc={business?.logoSrc} />
        </div>
        <div className="mt-2 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <div className="ml-auto flex shrink-0 items-center gap-1">
          {shop?.member_role === "owner" && <StoreSwitcher />}
          {shop?.member_role === "owner" && <HammerLink />}
          {shop?.member_role === "owner" && <StockAlertsBell />}
          <Button variant="ghost" size="icon" onClick={openInstallPrompt} aria-label={t("install.open")} title={t("install.open")}>
            <Download className="h-4 w-4" />
          </Button>
          <Link to="/settings" aria-label={t("app.nav.settings")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><Settings className="h-4 w-4" /></Link>
          <LanguageToggle />
          <ThemeToggle />
          <button aria-label="Sign out" onClick={signOut} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="min-w-0 pb-32 md:pb-24">
        <OfflineStatus />
        {!online && !billing && <div role="status" className="border-b border-warning/50 bg-warning/15 px-4 py-2 text-sm">{t("offline.planUnknown")}</div>}
        {shop?.member_role === "owner" && <BillingFailureAlert />}
        {locked ? (
          <div><PaymentTestModeBanner /><div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
            <h1 className="text-2xl font-bold">{t("billing.locked.title")}</h1>
            <p className="text-muted-foreground">{billing?.is_owner ? t("billing.locked.owner") : t("billing.locked.cashier")}</p>
            <BillingPanel />
          </div></div>
        ) : <Outlet />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-primary/50 bg-primary/50 pb-[env(safe-area-inset-bottom)] text-foreground shadow-[0_-8px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl md:hidden">
        {NAV.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" />{t(n.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function HammerLink() {
  const { t } = useT();
  return (
    <Link to="/stores" aria-label={t("stores.open_builder")} title={t("stores.open_builder")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/20 hover:bg-primary/30">
      <Hammer className="h-4 w-4 text-foreground" strokeWidth={2.5} />
    </Link>
  );
}
