import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export async function fetchShopProfile(shopId: string) {
  const { data, error } = await supabase.from("shops").select("id, name, logo_url, business_categories").eq("id", shopId).single();
  if (error) throw error;
  let logoSrc: string | null = null;
  if (data.logo_url) {
    const { data: signed } = await supabase.storage.from("shop-logos").createSignedUrl(data.logo_url, 3600);
    logoSrc = signed?.signedUrl ?? null;
  }
  return { ...data, logoSrc };
}

export function useShopProfile(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-profile", shopId],
    queryFn: () => shopId ? fetchShopProfile(shopId) : null,
    enabled: !!shopId,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: "always",
  });
}