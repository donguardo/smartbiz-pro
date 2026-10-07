import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, MoreVertical, PlusSquare, Share, Smartphone, WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { isInstalledApp } from "@/lib/install";

export const Route = createFileRoute("/install")({
  head: () => ({
    ...seo("/install"),
    meta: [
      { title: "Install MVP BizManager on iPhone & Android" },
      { name: "description", content: "Step-by-step guide to add MVP BizManager to your iPhone or Android home screen." },
      { property: "og:title", content: "Install MVP BizManager on iPhone & Android" },
      { property: "og:description", content: "Add MVP BizManager to your home screen in a few taps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstallGuide,
});

type BIPEvent = Event & { prompt: () => Promise<void> };

function InstallGuide() {
  const { t } = useT();
  const [tab, setTab] = useState<"ios" | "android">("android");
  const [installed, setInstalled] = useState(false);
  const [evt, setEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    setInstalled(isInstalledApp());
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setTab("ios");
    const onBIP = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const steps = tab === "ios"
    ? [
        { icon: Smartphone, text: t("guide.ios1") },
        { icon: Share, text: t("guide.ios2") },
        { icon: PlusSquare, text: t("guide.ios3") },
        { icon: CheckCircle2, text: t("guide.ios4") },
      ]
    : [
        { icon: Smartphone, text: t("guide.and1") },
        { icon: MoreVertical, text: t("guide.and2") },
        { icon: Download, text: t("guide.and3") },
        { icon: CheckCircle2, text: t("guide.and4") },
      ];

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm opacity-80 hover:opacity-100">
        <ArrowLeft className="h-4 w-4" />{t("guide.back")}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold">{t("guide.title")}</h1>
      <p className="mt-2 opacity-80">{t("guide.intro")}</p>

      {installed && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-success/50 p-3 font-semibold text-success">
          <CheckCircle2 className="h-5 w-5" />{t("install.installed")}
        </p>
      )}

      <div role="tablist" className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-primary/40 bg-primary/10 p-1">
        {(["android", "ios"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : ""}`}>
            {k === "ios" ? "iPhone / iPad" : "Android"}
          </button>
        ))}
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 backdrop-blur-md">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
            <s.icon className="mt-1 h-5 w-5 shrink-0" />
            <span>{s.text}</span>
          </li>
        ))}
      </ol>

      {tab === "android" && evt && !installed && (
        <Button className="mt-5 w-full" onClick={() => evt.prompt()}><Download className="h-4 w-4" />{t("install.cta")}</Button>
      )}

      <p className="mt-6 flex items-start gap-2 text-sm opacity-80">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />{t("guide.offline")}
      </p>
    </main>
  );
}
