import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

type Result = { ok: true } | { error: string };

// Ends the subscription at the end of the paid month (access stays until then).
async function endAtPeriodEnd(subId: string, env: string) {
  if (env !== "sandbox" && env !== "live") throw new Error("Unknown payments mode");
  await createStripeClient(env as StripeEnv).subscriptions.update(subId, { cancel_at_period_end: true });
}

// Platform admin approves (ends plan at month end) or marks "we'll reach out". Admin + MFA is checked in the database.
export const adminDecideCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approved" | "contacted"; note?: string }) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "contacted"]), note: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    try {
      const { data: t, error } = await context.supabase.rpc("admin_cancellation_target", { _id: data.id });
      if (error) return { error: "Not authorized or request no longer open" };
      const target = t?.[0];
      if (!target) return { error: "Request is no longer open" };
      if (data.decision === "approved") await endAtPeriodEnd(target.stripe_subscription_id, target.env);
      const { error: e2 } = await context.supabase.rpc("admin_decide_cancellation", { _id: data.id, _decision: data.decision, _note: data.note ?? "" });
      if (e2) return { error: "Could not save the decision" };
      return { ok: true };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

// Owner was contacted but still wants to cancel: they can always end the plan themselves.
export const ownerCancelAnyway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result> => {
    try {
      const { data: t, error } = await context.supabase.rpc("my_cancel_anyway_target");
      const target = t?.[0];
      if (error || !target) return { error: "No open cancellation request" };
      await endAtPeriodEnd(target.stripe_subscription_id, target.env);
      await context.supabase.rpc("mark_cancel_anyway", { _request_id: target.request_id });
      return { ok: true };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
