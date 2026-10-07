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
export function useCachedAt(name?: string) {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const update = () => {
      setAt(name ? offlineUsed.get(name) ?? null : offlineUsed.size ? Math.min(...offlineUsed.values()) : null);
      if (name && !navigator.onLine) void userKey().then((id) => {
        if (!active || navigator.onLine) return;
        try { const saved = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}:${id}:${name}`) ?? "null") as { at: number } | null; setAt(saved?.at ?? null); } catch { setAt(null); }
      });
    };
    const onOnline = () => { offlineUsed.clear(); update(); };
    window.addEventListener(CACHE_EVENT, update);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", update);
    update();
    return () => { active = false; window.removeEventListener(CACHE_EVENT, update); window.removeEventListener("online", onOnline); window.removeEventListener("offline", update); };
  }, [name]);
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
  error?: string | undefined;
  acceptPriceChange?: boolean;
  priceChange?: { old: number; new: number };
};
export function parsePriceChange(message: string) {
  const match = /^PRICE_CHANGED:([^:]+):([^:]+)$/.exec(message);
  if (!match) return null;
  const old = Number(match[1]), updated = Number(match[2]);
  return Number.isFinite(old) && Number.isFinite(updated) ? { old, new: updated } : null;
}
type QueueScope = { userId: string; shopId: string; key: string };
async function queueScope(): Promise<QueueScope | null> {
  const userId = await userKey();
  if (userId === "anon") return null;
  const shop = await withOfflineCache("fetchShopContext", async () => {
    const { data, error } = await supabase.rpc("get_my_shop_context");
    if (error) throw error;
    return data[0] ?? null;
  });
  if (!shop) return null;
  return { userId, shopId: shop.shop_id, key: `${QUEUE_PREFIX}:${userId}:${shop.shop_id}` };
}
function readQueue(scope: QueueScope): QueuedSale[] {
  try { return JSON.parse(localStorage.getItem(scope.key) ?? "[]"); } catch { return []; }
}
function writeQueue(scope: QueueScope, q: QueuedSale[]) {
  localStorage.setItem(scope.key, JSON.stringify(q));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type Lease = { tab: string; until: number };
async function withQueueLock(scope: QueueScope, kind: "sync" | "queue", work: (renew: () => void) => Promise<void>) {
  const name = `mvp-offline-${kind}:${scope.userId}:${scope.shopId}`;
  if (navigator.locks) {
    await navigator.locks.request(name, { ifAvailable: kind === "sync" }, async (lock) => {
      if (lock) await work(() => undefined);
    });
    return;
  }
  const key = `offline-${kind}-lease:${scope.userId}:${scope.shopId}`;
  const tab = crypto.randomUUID();
  const lease = (): Lease | null => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
  };
  while (true) {
    const current = lease();
    if (!current || current.until <= Date.now()) {
      localStorage.setItem(key, JSON.stringify({ tab, until: Date.now() + 30000 }));
      await pause(50);
      if (lease()?.tab === tab) break;
    }
    if (kind === "sync") return;
    await pause(50);
  }
  let lost = false;
  const heartbeat = () => {
    if (lease()?.tab !== tab) { lost = true; return; }
    localStorage.setItem(key, JSON.stringify({ tab, until: Date.now() + 30000 }));
  };
  const renew = () => { heartbeat(); if (lost) throw new Error("Offline queue lock was lost"); };
  const timer = setInterval(heartbeat, 10000);
  try { await work(renew); }
  finally { clearInterval(timer); if (lease()?.tab === tab) localStorage.removeItem(key); }
}
// In-tab serialization also protects fallback lease writers from one another.
let queueWriting: Promise<void> = Promise.resolve();
function updateQueue(scope: QueueScope, change: (q: QueuedSale[]) => QueuedSale[]) {
  const next = queueWriting.then(() => withQueueLock(scope, "queue", async (renew) => {
    renew();
    writeQueue(scope, change(readQueue(scope)));
  }));
  queueWriting = next.catch(() => undefined);
  return next;
}
export async function enqueueSale(s: Omit<QueuedSale, "id" | "createdAt"> & { id?: string }) {
  const scope = await queueScope();
  if (!scope) throw new Error("Your shop could not be loaded");
  const sale: QueuedSale = { ...s, id: s.id ?? crypto.randomUUID(), createdAt: Date.now() };
  await updateQueue(scope, (q) => q.some((x) => x.id === sale.id) ? q : [...q, sale]);
  return sale;
}
export async function discardQueuedSale(id: string) {
  const scope = await queueScope();
  if (scope) await updateQueue(scope, (q) => q.filter((s) => s.id !== id));
}
export function useQueuedSales() {
  const [list, setList] = useState<QueuedSale[]>([]);
  useEffect(() => {
    let active = true;
    let key: string | undefined;
    let revision = 0;
    const update = () => {
      const current = ++revision;
      void queueScope().then((scope) => {
        if (!active || current !== revision) return;
        key = scope?.key;
        setList(scope ? readQueue(scope) : []);
      }).catch(() => { /* Keep last visible queue if the shop cannot be read. */ });
    };
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) update(); };
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { setList([]); setTimeout(update, 0); });
    window.addEventListener(QUEUE_EVENT, update);
    window.addEventListener("storage", onStorage);
    update();
    return () => { active = false; authListener.subscription.unsubscribe(); window.removeEventListener(QUEUE_EVENT, update); window.removeEventListener("storage", onStorage); };
  }, []);
  return list;
}
let syncing = false;
/** Stable IDs prevent duplicates; the server checks prices and bounds original sale time. */
export async function syncQueuedSales(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0, failed = 0;
  try {
    const scope = await queueScope();
    if (!scope) return { synced, failed };
    await withQueueLock(scope, "sync", async (renew) => {
      for (const queued of readQueue(scope)) {
        const s = readQueue(scope).find((x) => x.id === queued.id);
        if (!s) continue;
        if (s.error) { failed++; continue; }
        const current = await queueScope();
        if (current?.key !== scope.key) break;
        let error: { message: string } | null;
        try {
          ({ error } = await supabase.rpc("record_sale", {
            _payment_method: s.method, _amount_tendered: s.tendered, _customer_id: s.customerId as string,
            _items: s.items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
            _client_sale_id: s.id, _client_created_at: new Date(s.createdAt).toISOString(),
            _expected_total: s.total, _accept_price_change: !!s.acceptPriceChange,
          }));
        } catch (err) { if (isNetworkError(err)) break; throw err; }
        renew();
        if (!error) { synced++; await updateQueue(scope, (q) => q.filter((x) => x.id !== s.id)); continue; }
        if (isNetworkError(error)) break;
        failed++;
        const priceChange = parsePriceChange(error.message);
        const message = priceChange ? `Prices changed since this sale: was ₱${priceChange.old.toFixed(2)}, now ₱${priceChange.new.toFixed(2)}.` : error.message;
        await updateQueue(scope, (q) => q.map((x) => (x.id === s.id ? { ...x, error: message, ...(priceChange ? { priceChange } : {}) } : x)));
      }
    });
  } finally { syncing = false; }
  return { synced, failed };
}
export async function retryQueuedSale(id: string, acceptPriceChange = false) {
  const scope = await queueScope();
  if (scope) await updateQueue(scope, (q) => q.map((x) => (x.id === id ? { ...x, error: undefined, acceptPriceChange: acceptPriceChange || !!x.acceptPriceChange } : x)));
  return syncQueuedSales();
}
