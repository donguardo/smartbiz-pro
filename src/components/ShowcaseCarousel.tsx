// ============= Full file contents =============

import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { SHOWCASE_SCENARIOS } from "@/lib/showcase-scenarios";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";

const AUTOPLAY_MS = 5000;

export function ShowcaseCarousel() {
  const { t, lang } = useT();
  const count = SHOWCASE_SCENARIOS.length;
  // Track renders [last, ...all, first] so a neighbour always peeks on both edges.
  const extended = [
    SHOWCASE_SCENARIOS[count - 1]!,
    ...SHOWCASE_SCENARIOS,
    SHOWCASE_SCENARIOS[0]!,
  ];
  // pos is the position in `extended`; real slides live at 1..count.
  const [pos, setPos] = useState(1);
  const [snap, setSnap] = useState(false); // true = jump without transition
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const paused = userPaused || hoverPaused || touchPaused;
  const realIndex = ((pos - 1) % count + count) % count;

  const goTo = (real: number) => {
    setSnap(false);
    setPos(real + 1);
  };
  const goPrev = () => setPos((p) => Math.max(0, p - 1));
  const goNext = () => setPos((p) => Math.min(count + 1, p + 1));

  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (pos === 0) {
      setSnap(true);
      setPos(count);
    } else if (pos === count + 1) {
      setSnap(true);
      setPos(1);
    }
  };

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

  const scenario = SHOWCASE_SCENARIOS[realIndex]!;
  // Centre the active card: cells stride --slide-stride, cards are stride minus gap.
  const trackTransform = `translateX(calc(50% - var(--slide-stride) * ${pos} - (var(--slide-stride) - var(--slide-gap)) / 2))`;

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
      <div className="-m-10 overflow-hidden rounded-[2rem] p-10">
        <div
          className="showcase-track"
          style={{ transform: trackTransform, transition: snap ? "none" : undefined }}
          onTransitionEnd={onTrackTransitionEnd}
        >
          {extended.map((s, i) => {
            const CellIcon = s.icon;
            const cellWeekly = s.categories.reduce((sum, c) => sum + c.sales, 0);
            const active = i === pos;
            return (
              <div
                key={`${s.slug}-${i}`}
                className="showcase-cell"
                aria-hidden={!active}
                onClick={() => {
                  if (!active) goTo(((i - 1) % count + count) % count);
                }}
              >
                <div
                  data-business-theme={s.theme}
                  className={`showcase-theme showcase-cell-inner overflow-hidden rounded-2xl border border-border bg-card shadow-xl transition-[opacity,transform,filter] duration-700 ${
                    active
                      ? "scale-100 opacity-100"
                      : "pointer-events-none scale-[0.94] opacity-50 blur-[1px]"
                  } ${!active ? "cursor-pointer" : ""}`}
                >
                <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <CellIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.name[lang]}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.sampleName}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-accent px-2.5 py-1 font-mono text-xs text-accent-foreground">
                    {peso(cellWeekly)}{t("showcase.perWeek")}
                  </span>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm font-medium">{s.tagline[lang]}</p>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{s.story[lang]}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.categories.slice(0, 3).map((c) => (
                      <span key={c.name.en} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {c.name[lang]}
                      </span>
                    ))}
                  </div>
                  <Link
                    to="/showcase/$business"
                    params={{ business: s.slug }}
                    tabIndex={active ? 0 : -1}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    {t("showcase.open")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        data-business-theme={scenario.theme}
        aria-hidden
        className="showcase-theme mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          key={realIndex}
          onAnimationEnd={(e) => {
            if (e.animationName === "showcase-progress") goNext();
          }}
          style={{ "--carousel-duration": `${AUTOPLAY_MS}ms` } as React.CSSProperties}
          className={`showcase-progress h-full rounded-full bg-primary ${paused ? "showcase-progress-paused" : ""}`}
        />
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goPrev}
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
              onClick={() => goTo(i)}
              aria-label={s.name[lang]}
              aria-current={i === realIndex}
              className={`h-2 rounded-full transition-all ${i === realIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goNext}
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
