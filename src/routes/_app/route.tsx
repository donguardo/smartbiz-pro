import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Download, LayoutDashboard, LogOut, Package, ScanLine, Settings, Users, BriefcaseBusiness } from "lucide-react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/lib/theme";
import { LanguageToggle, useT } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { fetchProfile, fetchShopContext, qk } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { openInstallPrompt } from "@/lib/install";

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
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/business", label: "Business", icon: BriefcaseBusiness },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppLayout() {
  const { session, loading } = useSession();
  const { t } = useT();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: fetchProfile, enabled: !!session });
  const { data: shop } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext, enabled: !!session });
  const visibleNav = shop?.member_role === "owner" ? [...NAV, ...OWNER_NAV] : NAV;

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("app.loading")}</div>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar p-4 backdrop-blur-xl md:flex">
        <Logo to="/dashboard" />
        <p className="mt-6 truncate px-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">{profile?.business_name ?? "…"}</p>
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
          <div className="rounded-lg border border-sidebar-border px-3 py-2 text-xs"><span className="font-semibold">{shop?.member_role === "owner" ? "Owner" : "Cashier"}</span><span className="block truncate text-muted-foreground">{session.user.email}</span></div>
          <Button variant="outline" className="w-full" onClick={openInstallPrompt}>
            <Download className="h-4 w-4" />{t("install.open")}
          </Button>
          <LanguageToggle className="w-full justify-center" />
          <div className="rounded-xl border border-sidebar-border p-3 text-xs text-muted-foreground">
            {t("app.plan")}: <span className="font-semibold text-foreground">₱499/user/mo</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => supabase.auth.signOut()} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border text-sm hover:bg-muted">
              <LogOut className="h-4 w-4" /> {t("app.signOut")}
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-1 border-b border-border bg-primary/30 px-3 py-3 backdrop-blur-md md:hidden">
        <Logo to="/dashboard" compact />
        <div className="flex shrink-0 gap-1.5">
          <Button variant="ghost" size="icon" onClick={openInstallPrompt} aria-label={t("install.open")} title={t("install.open")} className="hidden min-[420px]:inline-flex">
            <Download className="h-4 w-4" />
          </Button>
          <LanguageToggle />
          <ThemeToggle />
          <button aria-label="Sign out" onClick={() => supabase.auth.signOut()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="min-w-0 pb-24 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
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
