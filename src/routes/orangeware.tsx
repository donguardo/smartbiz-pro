import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";

const ORANGE_OS_URL = "https://orrange-ai-os.lovable.app";

export const Route = createFileRoute("/orangeware")({
  head: () => ({
    meta: [
      { title: "Orange AI OS — MVP BizManager" },
      { name: "description", content: "Orange AI OS, the glassmorphism mobile desktop experience from Orangeware, opened inside MVP BizManager." },
      { property: "og:title", content: "Orange AI OS" },
      { property: "og:description", content: "A glassmorphism mobile desktop experience by Orangeware." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrangeWare,
});

function OrangeWare() {
  const { t } = useT();
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  // If the frame never reports back (blocked, offline, slow network) offer the direct link.
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/50 px-3 py-2 backdrop-blur-xl sm:px-4">
        <Link to="/" className="inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-muted">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("orange.back")}</span>
        </Link>
        <a
          href={ORANGE_OS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">{t("orange.open")}</span>
        </a>
      </header>

      <div className="relative flex flex-1 flex-col">
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <p className="font-mono text-sm text-muted-foreground">{t("orange.loading")}</p>
          </div>
        )}
        {slow && !loaded && (
          <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-card p-4 text-center text-sm">
            <p className="text-muted-foreground">{t("orange.fallback")}</p>
            <a href={ORANGE_OS_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">
              <ExternalLink className="h-4 w-4" />
              {t("orange.title")}
            </a>
          </div>
        )}
        <iframe
          title={t("orange.title")}
          src={ORANGE_OS_URL}
          onLoad={() => {
            setLoaded(true);
            setSlow(false);
          }}
          allow="fullscreen; clipboard-read; clipboard-write; autoplay; web-share; encrypted-media; picture-in-picture"
          className="h-full w-full flex-1 border-0 bg-background"
        />
      </div>
    </div>
  );
}
