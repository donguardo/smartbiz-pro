import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export type BusinessTheme = "brand" | "cafe" | "coffeehouse" | "fiesta";

const THEME_STORAGE_KEY = "business-theme";
const BUSINESS_THEMES: { id: BusinessTheme; labelKey: string }[] = [
  { id: "brand", labelKey: "theme.brand" },
  { id: "cafe", labelKey: "theme.cafe" },
  { id: "coffeehouse", labelKey: "theme.coffeehouse" },
  { id: "fiesta", labelKey: "theme.fiesta" },
];

function isBusinessTheme(value: string | null): value is BusinessTheme {
  return BUSINESS_THEMES.some((theme) => theme.id === value);
}

function applyBusinessTheme(theme: BusinessTheme) {
  if (theme === "brand") document.documentElement.removeAttribute("data-business-theme");
  else document.documentElement.dataset["businessTheme"] = theme;
}

export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}var b=localStorage.getItem('${THEME_STORAGE_KEY}');if(b==='cafe'||b==='coffeehouse'||b==='fiesta'){document.documentElement.setAttribute('data-business-theme',b)}}catch(e){}})()`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted ${className}`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function BusinessThemePicker() {
  const { t } = useT();
  const [selected, setSelected] = useState<BusinessTheme>("brand");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    setSelected(isBusinessTheme(saved) ? saved : "brand");
  }, []);

  const chooseTheme = (theme: BusinessTheme) => {
    applyBusinessTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    setSelected(theme);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("theme.title")}>
      {BUSINESS_THEMES.map((theme) => {
        const active = selected === theme.id;
        return (
          <Button
            key={theme.id}
            type="button"
            variant="outline"
            role="radio"
            aria-checked={active}
            onClick={() => chooseTheme(theme.id)}
            className={`h-auto min-h-16 justify-start px-4 py-3 ${active ? "border-primary bg-primary/10 ring-2 ring-primary" : ""}`}
          >
            <span className="flex shrink-0 -space-x-1" aria-hidden>
              {[1, 2, 3].map((swatch) => (
                <span key={swatch} className={`theme-swatch theme-swatch-${theme.id}-${swatch}`} />
              ))}
            </span>
            <span className="min-w-0 text-left font-semibold text-foreground">{t(theme.labelKey)}</span>
          </Button>
        );
      })}
    </div>
  );
}
