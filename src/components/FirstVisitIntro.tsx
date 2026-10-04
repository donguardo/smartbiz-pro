import { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import introVideo from "@/assets/bizmanager-intro.mp4.asset.json";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const INTRO_SEEN_KEY = "bizmanager-intro-seen-v1";
export const INTRO_COMPLETE_EVENT = "bizmanager-intro-complete";

export function FirstVisitIntro() {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(INTRO_SEEN_KEY)) return;
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void videoRef.current?.play().catch(() => undefined);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  const finish = () => {
    localStorage.setItem(INTRO_SEEN_KEY, "1");
    setShow(false);
    window.dispatchEvent(new Event(INTRO_COMPLETE_EVENT));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background" role="dialog" aria-label={t("intro.title")}>
      <video
        ref={videoRef}
        src={introVideo.url}
        className="h-full w-full object-contain"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
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