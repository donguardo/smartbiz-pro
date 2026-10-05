import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { SHOWCASE_SCENARIOS } from "@/lib/showcase-scenarios";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";

const AUTOPLAY_MS = 5000;

export function ShowcaseCarousel() {
  const { t, lang } = useT();
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = SHOWCASE_SCENARIOS.length;
  const paused = userPaused || hoverPaused || touchPaused;

  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setTouchPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    setTouchPaused(false);
    if (start == null) return;
    const delta = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);

  const scenario = SHOWCASE_SCENARIOS[index]!;
  const Icon = scenario.icon;
  const weeklySales = scenario.categories.reduce((sum, c) => sum + c.sales, 0);

  return (
    <div
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHoverPaused(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHoverPaused(false);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      aria-label={t("nav.showcase")}
    >
      <div className="-m-3 overflow-hidden rounded-[1.75rem] p-3">
        <div
          key={scenario.slug}
          data-business-theme={scenario.theme}
          className="showcase-theme showcase-slide-in overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        >
        <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{scenario.name[lang]}</p>
            <p className="truncate text-xs text-muted-foreground">{scenario.sampleName}</p>
          </div>
          <span className="ml-auto rounded-full bg-accent px-2.5 py-1 font-mono text-xs text-accent-foreground">
            {peso(weeklySales)}{t("showcase.perWeek")}
          </span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-medium">{scenario.tagline[lang]}</p>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{scenario.story[lang]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {scenario.categories.slice(0, 3).map((c) => (
              <span key={c.name.en} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {c.name[lang]}
              </span>
            ))}
          </div>
          <Link
            to="/showcase/$business"
            params={{ business: scenario.slug }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {t("showcase.open")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((index - 1 + count) % count)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
          aria-label={t("common.back")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {SHOWCASE_SCENARIOS.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={s.name[lang]}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIndex((index + 1) % count)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
          aria-label={t("common.next")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span aria-hidden className="h-5 w-px bg-border" />
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-pressed={userPaused}
          aria-label={userPaused ? t("carousel.play") : t("carousel.pause")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
        >
          {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
