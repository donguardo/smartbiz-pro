import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";

const BLOCKHOLE_URL = "https://blockhole-game.lovable.app";

export const Route = createFileRoute("/blockhole")({
  head: () => ({
    meta: [
      { title: "Blockhole — MVP BizManager" },
      { name: "description", content: "Blockhole, the browser arcade game, played inside MVP BizManager." },
      { property: "og:title", content: "Blockhole" },
      { property: "og:description", content: "Play Blockhole in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Blockhole,
});

function Blockhole() {
  const { t } = useT();
  const [loaded, setLoaded] = useState(false);

  // The embedded game holds its connection open, so its "load" event can arrive late or
  // never: the splash is time-boxed so the game is always revealed.
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/50 px-3 py-2 backdrop-blur-xl sm:px-4">
        <Link to="/" className="inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-muted">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("blockhole.back")}</span>
        </Link>
        <a
          href={BLOCKHOLE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">{t("blockhole.open")}</span>
        </a>
      </header>

      <div className="relative flex flex-1 flex-col">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <p className="font-mono text-sm text-muted-foreground">{t("blockhole.loading")}</p>
          </div>
        )}
        <iframe
          title={t("blockhole.title")}
          src={BLOCKHOLE_URL}
          onLoad={() => setLoaded(true)}
          allow="fullscreen; clipboard-read; clipboard-write; autoplay; gamepad"
          className="h-full w-full flex-1 border-0 bg-background"
        />
      </div>
    </div>
  );
}
