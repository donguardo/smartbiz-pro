import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Billing = { has_access: boolean; state: string; trial_ends_at: string | null; period_end: string | null; cancel_at_period_end: boolean; is_owner: boolean; env: "sandbox" | "live" };

export const billingKey = ["billing"] as const;

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: billingKey,
    enabled,
    queryFn: async (): Promise<Billing> => {
      // The server decides the payments mode (app_config.payments_env); the argument is ignored.
      const { data, error } = await supabase.rpc("get_shop_billing", { _env: "server" });
      if (error) throw error;
      return data[0] as Billing;
    },
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
