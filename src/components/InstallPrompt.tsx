import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import logoAsset from "@/assets/logo.png.asset.json";
import { INTRO_COMPLETE_EVENT, INTRO_SEEN_KEY } from "@/components/FirstVisitIntro";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "install-prompt-seen-v1";

export function InstallPrompt() {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone || localStorage.getItem(KEY)) return;
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onBIP = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const onInstalled = () => { localStorage.setItem(KEY, "1"); setShow(false); };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { timer = setTimeout(() => setShow(true), 1500); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    if (localStorage.getItem(INTRO_SEEN_KEY)) schedule();
    else window.addEventListener(INTRO_COMPLETE_EVENT, schedule, { once: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(INTRO_COMPLETE_EVENT, schedule);
    };
  }, []);

  const [showSteps, setShowSteps] = useState(false);
  const close = () => { localStorage.setItem(KEY, "1"); setShow(false); };
  const install = async () => {
    if (!evt) { setShowSteps(true); return; }
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") close();
    else setShowSteps(true);
  };

  if (!show) return null;
  return (
    <div role="dialog" aria-label={t("install.title")} className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-primary/50 bg-primary/40 p-4 text-foreground shadow-2xl backdrop-blur-md">
      <button onClick={close} aria-label={t("install.later")} className="absolute right-2 top-2 rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3 pr-6">
        <img src={logoAsset.url} alt="" className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="font-display font-bold">{t("install.title")}</p>
          <p className="mt-1 text-sm opacity-80">{t("install.body")}</p>
          {(!evt || showSteps) && (
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              {isIOS && <Share className="h-4 w-4 shrink-0" />}{isIOS ? t("install.ios") : t("install.manual")}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={close} className="rounded-lg border border-border px-3 py-2 text-sm">{t("install.later")}</button>
        <button onClick={install} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Download className="h-4 w-4" />{t("install.cta")}
        </button>
      </div>
    </div>
  );
}
