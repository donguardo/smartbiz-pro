import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public: called by the storefront right after an order is placed. It returns nothing,
// only acts on a real order created in the last 10 minutes, and each order emails at most once.
export const notifyNewStorefrontOrder = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; orderNo: string }) =>
    z.object({ slug: z.string().min(1).max(80), orderNo: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: shop } = await supabaseAdmin.from("shops").select("id, name, business_account_id").eq("slug", data.slug).maybeSingle();
      if (!shop?.business_account_id) return { ok: true };
      const since = new Date(Date.now() - 10 * 60000).toISOString();
      const { data: order } = await supabaseAdmin.from("storefront_orders")
        .select("id, order_no, customer_name, total, note").eq("shop_id", shop.id).eq("order_no", data.orderNo).gte("created_at", since).maybeSingle();
      if (!order) return { ok: true };
      const [{ data: items }, { data: acct }] = await Promise.all([
        supabaseAdmin.from("storefront_order_items").select("name, qty, unit").eq("order_id", order.id),
        supabaseAdmin.from("business_accounts").select("owner_user_id").eq("id", shop.business_account_id).maybeSingle(),
      ]);
      if (!acct) return { ok: true };
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(acct.owner_user_id);
      const email = u?.user?.email;
      if (!email) return { ok: true };
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("new-order-owner", email, {
        templateData: {
          shop: shop.name, orderNo: order.order_no, customer: order.customer_name, note: order.note ?? "",
          total: `₱${Number(order.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
          items: (items ?? []).map((i) => ({ name: i.name, qty: Number(i.qty), unit: i.unit })),
        },
        idempotencyKey: `new-order-owner-${order.id}`,
      });
    } catch (e) {
      // The order is saved and shows in the app even if the email fails.
      console.error("new order email failed", e instanceof Error ? e.message : e);
    }
    return { ok: true };
  });
