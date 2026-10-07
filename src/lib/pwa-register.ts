// Single place that registers the offline service worker. Never runs in dev or the editor preview.
const SW_URL = "/sw.js";

function refused() {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  const blocked = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];
  if (blocked.some((d) => h === d || h.endsWith("." + d))) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterOurs() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith(SW_URL) || r.installing?.scriptURL.endsWith(SW_URL) || r.waiting?.scriptURL.endsWith(SW_URL)).map((r) => r.unregister()));
}

export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) { void unregisterOurs(); return; }
  const go = () => navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch((e) => console.warn("SW register failed", e));
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
