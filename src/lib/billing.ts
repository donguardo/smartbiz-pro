import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withOfflineCache } from "@/lib/offline";

export type Billing = { has_access: boolean; state: string; trial_ends_at: string | null; period_end: string | null; cancel_at_period_end: boolean; is_owner: boolean; env: "sandbox" | "live" };

export const billingKey = ["billing"] as const;

export function offlineLocked(b: Billing) {
  if (!b.has_access) return true;
  const now = Date.now();
  if (b.state === "trial" && b.trial_ends_at && new Date(b.trial_ends_at).getTime() < now) return true;
  if (["active", "trialing", "canceled"].includes(b.state) && b.period_end && new Date(b.period_end).getTime() < now) return true;
  return b.state === "past_due" && !!b.period_end && new Date(b.period_end).getTime() < now - 7 * 86400000;
}

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: billingKey,
    enabled,
    queryFn: (): Promise<Billing> => withOfflineCache("billing", async () => {
      // The server decides the payments mode (app_config.payments_env); the argument is ignored.
      const { data, error } = await supabase.rpc("get_shop_billing", { _env: "server" });
      if (error) throw error;
      return data[0] as Billing;
    }),
  });
}

export function usePaymentsEnv(enabled = true) {
  return useQuery({
    queryKey: ["payments-env"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<"sandbox" | "live"> => {
      const { data, error } = await supabase.rpc("get_payments_env");
      if (error) throw error;
      return data as "sandbox" | "live";
    },
  });
}
