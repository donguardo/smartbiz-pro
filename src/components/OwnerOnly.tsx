import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchShopContext, qk } from "@/lib/store";

export function OwnerOnly({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: qk.shop, queryFn: fetchShopContext });
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (data?.member_role !== "owner") return <div className="mx-auto max-w-lg p-8 text-center"><h1 className="text-2xl font-bold">Owner access only</h1><p className="mt-2 text-muted-foreground">Your cashier account cannot open this page.</p><Link to="/pos" className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Open register</Link></div>;
  return children;
}