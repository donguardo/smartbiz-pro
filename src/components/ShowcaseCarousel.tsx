import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { SHOWCASE_SCENARIOS } from "@/lib/showcase-scenarios";
import { useT } from "@/lib/i18n";
import { peso } from "@/lib/format";

const AUTOPLAY_MS = 5000;

// SSR-safe: starts false, syncs after mount so hydration never mismatches.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ShowcaseCarousel() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const count = SHOWCASE_SCENARIOS.length;
  // Track renders the deck three times so navigation can keep sliding past the
  // edges in the same direction; the position is re-centred invisibly after
  // each slide finishes, making the loop truly endless.
  const extended = [
    ...SHOWCASE_SCENARIOS,
    ...SHOWCASE_SCENARIOS,
    ...SHOWCASE_SCENARIOS,
  ];
  // pos is the position in `extended`; the middle copy's slides live at count..2*count-1.
  const [pos, setPos] = useState(count);
  const [snap, setSnap] = useState(false); // true = jump without transition
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [announce, setAnnounce] = useState("");
  const touchStartX = useRef<number | null>(null);
  // Reduced-motion users get no autoplay; the rest pause for hover, touch or focus.
  const paused = userPaused || hoverPaused || touchPaused || focusPaused;
  const realIndex = (((pos - count) % count) + count) % count;
  // Equivalent middle-copy position for the same visual slide.
  const normalize = (p: number) => count + ((((p - count) % count) + count) % count);

  const slideLabel = (i: number) =>
    t("carousel.slideOf")
      .replace("{n}", String(i + 1))
      .replace("{total}", String(count))
      .replace("{name}", SHOWCASE_SCENARIOS[i]!.name[lang]);

  const goTo = (real: number) => {
    setSnap(false);
    setPos(count + real);
    setAnnounce(slideLabel(real));
  };
  const jumpTo = (real: number) => {
    // Reduced motion: no transition runs, so land directly on the slide.
    setSnap(true);
    setPos(count + real);
    setAnnounce(slideLabel(real));
  };
  // Step one slide in `dir`; if the next step would run past the rendered
  // copies, re-centre on the equivalent slide first, then slide as normal.
  const step = (dir: 1 | -1, target: number) => {
    if (reduced) {
      jumpTo(target);
      return;
    }
    const next = pos + dir;
    if (next < 1 || next > extended.length - 2) {
      setSnap(true);
      setPos(normalize(pos));
      // Wait for the re-centred frame to paint before sliding again.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSnap(false);
          setPos((p) => normalize(p) + dir);
        })
      );
    } else {
      setSnap(false);
      setPos(next);
    }
  };
  const goPrev = () => step(-1, (realIndex - 1 + count) % count);
  const goNext = () => step(1, (realIndex + 1) % count);

  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (pos < count || pos >= 2 * count) {
      // Same slide, re-centred in the middle copy — visually invisible.
      setSnap(true);
      setPos(normalize(pos));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Arrow keys move between samples as soon as focus enters the carousel,
    // so keyboard users never tab through every control to browse.
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
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
      role="region"
      aria-roledescription="carousel"
      aria-label={t("nav.showcase")}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHoverPaused(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHoverPaused(false);
      }}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={() => setFocusPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <p aria-live="polite" role="status" className="sr-only">
        {announce}
      </p>
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
            const realI = (((i - count) % count) + count) % count;
            return (
              <div
                key={`${s.slug}-${i}`}
                className="showcase-cell"
                aria-hidden={!active}
                onClick={() => {
                  if (!active) goTo(realI);
                }}
              >
                <div
                  data-business-theme={s.theme}
                  role={active ? "group" : undefined}
                  aria-roledescription={active ? "slide" : undefined}
                  aria-label={active ? slideLabel(realI) : undefined}
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
                    className={`mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 ${focusRing}`}
                  >
                    {t("showcase.open")} <ArrowRight className="h-4 w-4" aria-hidden />
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
            if (e.animationName === "showcase-progress" && !reduced) goNext();
          }}
          style={{ "--carousel-duration": `${AUTOPLAY_MS}ms` } as React.CSSProperties}
          className={`showcase-progress h-full rounded-full bg-primary ${paused ? "showcase-progress-paused" : ""}`}
        />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted ${focusRing}`}
          aria-label={t("carousel.previous")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex gap-0.5">
          {SHOWCASE_SCENARIOS.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => goTo(i)}
              aria-label={slideLabel(i)}
              aria-current={i === realIndex ? "true" : undefined}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${focusRing}`}
            >
              <span
                aria-hidden
                className={`h-2 rounded-full transition-all ${i === realIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={goNext}
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted ${focusRing}`}
          aria-label={t("carousel.nextBusiness")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        {!reduced && (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-pressed={userPaused}
              aria-label={userPaused ? t("carousel.play") : t("carousel.pause")}
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted ${focusRing}`}
            >
              {userPaused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
