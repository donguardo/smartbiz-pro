import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export type Billing = { has_access: boolean; state: string; trial_ends_at: string | null; period_end: string | null; cancel_at_period_end: boolean; is_owner: boolean };

export const billingKey = ["billing"] as const;

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: billingKey,
    enabled,
    queryFn: async (): Promise<Billing> => {
      const { data, error } = await supabase.rpc("get_shop_billing", { _env: getPaddleEnvironment() });
      if (error) throw error;
      return data[0] as Billing;
    },
  });
}
