// Minimal Stripe REST client (fetch + WebCrypto) so it runs on the Worker runtime.
const API = "https://api.stripe.com/v1";

function key(): string {
  const k = process.env["STRIPE_SECRET_KEY"];
  if (!k) throw new Error("Stripe is not configured");
  return k;
}

// Test keys map to the app's "sandbox" mode so the same access rules apply as for Paddle.
export function stripeEnv(): "sandbox" | "live" {
  return key().startsWith("sk_live_") || key().startsWith("rk_live_") ? "live" : "sandbox";
}

function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? form(item as Record<string, unknown>, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item))));
    else if (typeof v === "object") form(v as Record<string, unknown>, name, out);
    else out.append(name, String(v));
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function stripe(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded" },
    ...(body ? { body: form(body).toString() } : {}),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Stripe error", res.status, json?.error?.message);
    throw new Error(json?.error?.message ?? "Stripe request failed");
  }
  return json;
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verifies the Stripe-Signature header (v1 HMAC-SHA256, 5-minute tolerance).
export async function verifyStripeWebhook(payload: string, header: string | null) {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!header) throw new Error("Missing signature");
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) throw new Error("Bad signature header");
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error("Signature too old");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${payload}`)));
  if (!sigs.some((s) => s.length === expected.length && [...s].every((c, i) => c === expected[i]))) throw new Error("Invalid signature");
  return JSON.parse(payload);
}
