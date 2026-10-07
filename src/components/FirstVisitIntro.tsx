import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SkipForward, Volume2, VolumeX } from "lucide-react";
import introVideo from "@/assets/bizmanager-intro-ads.mp4.asset.json";
import introVideoWebm from "@/assets/bizmanager-intro.webm.asset.json";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

// Bumped to v2 when the intro video was replaced: visitors who already saw the
// old intro get the new one once.
export const INTRO_SEEN_KEY = "bizmanager-intro-seen-v2";
export const INTRO_COMPLETE_EVENT = "bizmanager-intro-complete";

export function FirstVisitIntro() {
  const { t } = useT();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [show, setShow] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (pathname !== "/") {
      setShow(false);
      return;
    }
    // Email confirmation links can land on the homepage: hand them to the sign-in page, no promo video.
    if (/access_token|error_code|type=signup/.test(window.location.hash)) {
      window.location.replace(`/auth?confirmed=1${window.location.hash}`);
      return;
    }
    if (localStorage.getItem(INTRO_SEEN_KEY)) return;
    setShow(true);
  }, [pathname]);

  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const video = videoRef.current;
    let active = true;
    if (video) {
      video.muted = false;
      setMuted(false);
      void video.play().catch(() => {
        if (!active) return;
        // Browsers may require a tap before allowing audible autoplay.
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => undefined);
      });
    }
    return () => {
      active = false;
      video?.pause();
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  const finish = () => {
    videoRef.current?.pause();
    localStorage.setItem(INTRO_SEEN_KEY, "1");
    setShow(false);
    window.dispatchEvent(new Event(INTRO_COMPLETE_EVENT));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background" role="dialog" aria-label={t("intro.title")}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        muted={muted}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      >
        <source src={introVideoWebm.url} type="video/webm" />
        <source src={introVideo.url} type="video/mp4" />
      </video>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={t(muted ? "intro.soundOn" : "intro.soundOff")}
        title={t(muted ? "intro.soundOn" : "intro.soundOff")}
        aria-pressed={!muted}
        onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          video.muted = !muted;
          setMuted(!muted);
          void video.play().catch(() => undefined);
        }}
        className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] h-11 w-11 border border-border bg-popover/90 shadow-2xl backdrop-blur-md sm:left-6"
      >
        {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={finish}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] border border-border bg-popover/90 shadow-2xl backdrop-blur-md sm:right-6"
      >
        {t("intro.skip")}
        <SkipForward aria-hidden="true" />
      </Button>
    </div>
  );
}