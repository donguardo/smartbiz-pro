import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------- Device-local cache of the last good server reads (per signed-in user) ----------
const CACHE_PREFIX = "offline-cache-v1";
const CACHE_EVENT = "offline-cache-change";

async function userKey() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? "anon";
}

export function isNetworkError(err: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
  return /failed to fetch|network|load failed|fetch failed/i.test(msg);
}

/** Runs a server read; saves the result on success, returns the saved copy when offline. */
export async function withOfflineCache<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const key = `${CACHE_PREFIX}:${await userKey()}:${name}`;
  try {
    const data = await fn();
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* storage full */ }
    window.dispatchEvent(new Event(CACHE_EVENT));
    return data;
  } catch (err) {
    const raw = isNetworkError(err) ? localStorage.getItem(key) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; data: T };
      offlineUsed.set(name, parsed.at);
      window.dispatchEvent(new Event(CACHE_EVENT));
      return parsed.data;
    }
    throw err;
  }
}
const offlineUsed = new Map<string, number>();
/** Oldest saved time among caches served while offline (null when everything is live). */
export function useCachedAt() {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setAt(offlineUsed.size ? Math.min(...offlineUsed.values()) : null);
    const onOnline = () => { offlineUsed.clear(); update(); };
    window.addEventListener(CACHE_EVENT, update);
    window.addEventListener("online", onOnline);
    update();
    return () => { window.removeEventListener(CACHE_EVENT, update); window.removeEventListener("online", onOnline); };
  }, []);
  return at;
}

export function clearOfflineData() {
  for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE_PREFIX) || k.startsWith(QUEUE_PREFIX)) localStorage.removeItem(k);
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; },
    () => navigator.onLine,
    () => true,
  );
}

// ---------- Offline sales queue ----------
const QUEUE_PREFIX = "offline-sales-v1";
const QUEUE_EVENT = "offline-sales-change";
export type QueuedSale = {
  id: string; createdAt: number; method: string; tendered: number; total: number;
  customerId: string | null; items: { product_id: string; qty: number; name: string; price: number }[];
  error?: string;
};

async function queueKey() { return `${QUEUE_PREFIX}:${await userKey()}`; }
async function readQueue(): Promise<QueuedSale[]> {
  try { return JSON.parse(localStorage.getItem(await queueKey()) ?? "[]"); } catch { return []; }
}
async function writeQueue(q: QueuedSale[]) {
  localStorage.setItem(await queueKey(), JSON.stringify(q));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}
export async function enqueueSale(s: Omit<QueuedSale, "id" | "createdAt">) {
  const sale: QueuedSale = { ...s, id: crypto.randomUUID(), createdAt: Date.now() };
  await writeQueue([...(await readQueue()), sale]);
  return sale;
}
export async function discardQueuedSale(id: string) { await writeQueue((await readQueue()).filter((s) => s.id !== id)); }

export function useQueuedSales() {
  const [list, setList] = useState<QueuedSale[]>([]);
  useEffect(() => {
    const update = () => { void readQueue().then(setList); };
    window.addEventListener(QUEUE_EVENT, update);
    update();
    return () => window.removeEventListener(QUEUE_EVENT, update);
  }, []);
  return list;
}

let syncing = false;
/** Sends waiting sales one by one. Totals, cost and time are set by the server at sync. */
export async function syncQueuedSales(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0, failed = 0;
  try {
    for (const s of await readQueue()) {
      if (s.error) { failed++; continue; }
      const { error } = await supabase.rpc("record_sale", {
        _payment_method: s.method, _amount_tendered: s.tendered, _customer_id: s.customerId as string,
        _items: s.items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
      });
      const q = await readQueue();
      if (!error) { synced++; await writeQueue(q.filter((x) => x.id !== s.id)); continue; }
      if (isNetworkError(error)) break;
      failed++;
      await writeQueue(q.map((x) => (x.id === s.id ? { ...x, error: error.message } : x)));
    }
  } finally { syncing = false; }
  return { synced, failed };
}
export async function retryQueuedSale(id: string) {
  await writeQueue((await readQueue()).map((x) => (x.id === id ? { ...x, error: undefined } : x)));
  return syncQueuedSales();
}
