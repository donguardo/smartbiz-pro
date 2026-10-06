import { resolvePaddlePrice } from "@/utils/payments.functions";
import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let ready: Promise<void> | null = null;
export function initializePaddle() {
  if (ready) return ready;
  if (!clientToken) return Promise.reject(new Error("Payments are not configured"));
  ready = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
      window.Paddle.Initialize({ token: clientToken });
      resolve();
    };
    script.onerror = () => { ready = null; reject(new Error("Could not load checkout")); };
    document.head.appendChild(script);
  });
  return ready;
}

export async function openSubscriptionCheckout(opts: { userId: string; email?: string | undefined }) {
  // Never open checkout when the client token's mode doesn't match the server's payments mode.
  const { data: serverEnv, error } = await supabase.rpc("get_payments_env");
  if (error || serverEnv !== getPaddleEnvironment()) throw new Error("Payments are being set up. Please try again later.");
  await initializePaddle();
  const priceId = await resolvePaddlePrice({ data: { priceId: "bizmanager_monthly", environment: getPaddleEnvironment() } });
  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: opts.email ? { email: opts.email } : undefined,
    customData: { userId: opts.userId },
    settings: { displayMode: "overlay", successUrl: `${window.location.origin}/billing?checkout=success`, allowLogout: false, variant: "one-page" },
  });
}
