import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, LayoutDashboard, LogOut, Package, ScanLine } from "lucide-react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/lib/theme";
import { Logo } from "@/components/Logo";
import { fetchProfile, qk } from "@/lib/store";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "Register", icon: ScanLine },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/copilot", label: "AI Manager", icon: Bot },
] as const;

function AppLayout() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  const { data: profile } = useQuery({ queryKey: qk.profile, queryFn: fetchProfile, enabled: !!session });

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading your store…</div>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar p-4 backdrop-blur-xl md:flex">
        <Logo to="/dashboard" />
        <p className="mt-6 truncate px-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">{profile?.business_name ?? "…"}</p>
        <nav className="mt-2 space-y-1">
          {NAV.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-sidebar-border p-3 text-xs text-muted-foreground">
            Plan: <span className="font-semibold text-foreground">₱499/user/mo</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => supabase.auth.signOut()} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border text-sm hover:bg-muted">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-primary/30 px-4 py-3 backdrop-blur-md md:hidden">
        <Logo to="/dashboard" />
        <div className="flex gap-2">
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
              <n.icon className="h-5 w-5" />{n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
