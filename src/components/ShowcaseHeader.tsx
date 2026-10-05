import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageToggle, useT } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";

export function ShowcaseHeader({ backToGallery = false }: { backToGallery?: boolean }) {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          {backToGallery && <Link to="/showcase" aria-label={t("common.back")} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>}
          <Link to="/"><Logo /></Link>
        </div>
        <div className="flex shrink-0 items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
      </div>
    </header>
  );
}