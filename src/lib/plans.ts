import { PLAN_PRICES } from "@/lib/format";

export type PlanId = keyof typeof PLAN_PRICES;
export const PLAN_IDS: PlanId[] = ["basic", "standard", "pro"];
/** Translation keys for each plan card (shared by Billing and the public pricing section). */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  basic: ["plan.basic.f1", "plan.basic.f2", "plan.basic.f3", "plan.basic.f4"],
  standard: ["plan.standard.f1", "plan.standard.f2", "plan.standard.f3", "plan.f.bestOrders", "plan.f.noAds"],
  pro: ["plan.pro.f1", "plan.pro.f2", "plan.pro.f3", "plan.f.bestOrders", "plan.f.noAds"],
};
export const PLAN_ALL_FEATURES = ["plan.all.f1", "plan.all.f2", "plan.all.f3"];
