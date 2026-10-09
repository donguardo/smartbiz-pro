import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type StorefrontProduct = { id: string; name: string; category: string; price: number; unit: string; in_stock: boolean };
export type Storefront = { shop_name: string; categories: string[]; slug: string; products: StorefrontProduct[] } | null;

// Public read: uses the publishable key and the anon-callable storefront functions only.
export const getStorefront = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data }): Promise<Storefront> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (i, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(i, { ...init, headers: h });
        },
      },
    });
    const slug = data.slug.toLowerCase();
    const { data: shop, error } = await client.rpc("public_storefront", { _slug: slug });
    if (error) throw new Error("Storefront unavailable");
    const row = shop?.[0];
    if (!row) return null;
    const { data: products } = await client.rpc("public_storefront_products", { _slug: slug });
    return {
      shop_name: row.shop_name,
      categories: row.categories ?? [],
      slug: row.slug,
      products: ((products ?? []) as StorefrontProduct[]).map((p) => ({ ...p, price: Number(p.price) })),
    };
  });
