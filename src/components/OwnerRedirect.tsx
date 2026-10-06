import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchShopContext, qk } from "@/lib/store";

// Billing and Reorders are owner-only: cashiers are sent back to the dashboard.
export function OwnerRedirect({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext, retry: 1 });
  const notOwner = !isLoading && !isError && !!data && data.member_role !== "owner";
  useEffect(() => {
    if (notOwner) {
      toast.error("Only the shop owner can open this page.");
      void navigate({ to: "/dashboard" });
    }
  }, [notOwner, navigate]);
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (isError || !data) return <div className="mx-auto max-w-lg p-8 text-center"><h1 className="text-2xl font-bold">We couldn’t load your shop</h1><p className="mt-2 text-muted-foreground">Check your connection and try again.</p><button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Reload</button></div>;
  if (notOwner) return null;
  return children;
}
