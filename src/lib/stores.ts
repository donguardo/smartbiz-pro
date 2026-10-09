import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const storesKey = ["my-stores"];

export async function fetchMyStores() {
  const { data, error } = await supabase.rpc("list_my_stores");
  if (error) throw error;
  return data ?? [];
}

export function useMyStores(enabled = true) {
  return useQuery({ queryKey: storesKey, queryFn: fetchMyStores, enabled });
}

/** Switch the active store, then refetch everything so every screen shows the new store. */
export function useSwitchStore() {
  const qc = useQueryClient();
  return async (shopId: string) => {
    const { error } = await supabase.rpc("switch_my_store", { _shop_id: shopId });
    if (error) throw error;
    await qc.invalidateQueries();
  };
}

export function storeErrorMessage(e: unknown, t: (k: string) => string) {
  const msg = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (msg.includes("STORE_LIMIT")) return t("stores.limitReached");
  if (msg.includes("CATEGORY_LIMIT")) return t("stores.oneCategory");
  return msg || t("stores.error");
}
