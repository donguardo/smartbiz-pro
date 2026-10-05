import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export type BusinessTheme = "brand" | "cafe" | "coffeehouse" | "fiesta" | "custom";
const CUSTOM_KEY = "business-theme-custom";


const THEME_STORAGE_KEY = "business-theme";
const BUSINESS_THEMES: { id: BusinessTheme; labelKey: string }[] = [
  { id: "brand", labelKey: "theme.brand" },
  { id: "cafe", labelKey: "theme.cafe" },
  { id: "coffeehouse", labelKey: "theme.coffeehouse" },
  { id: "fiesta", labelKey: "theme.fiesta" },
];

/** 24-color mixing palette for the custom theme builder. */
export const CUSTOM_PALETTE = [
  "#FF00FF", "#C026D3", "#7C3AED", "#4F46E5", "#2563EB", "#0EA5E9",
  "#06B6D4", "#14B8A6", "#10B981", "#00754A", "#65A30D", "#84CC16",
  "#EAB308", "#F59E0B", "#F97316", "#EA580C", "#DC2626", "#E11D48",
  "#BE185D", "#6F4E37", "#A0522D", "#D4A373", "#64748B", "#1E293B",
];
export type CustomColors = { primary: string; accent: string; highlight: string };
const DEFAULT_CUSTOM: CustomColors = { primary: "#FF00FF", accent: "#7C3AED", highlight: "#0EA5E9" };
const CUSTOM_VARS = ["--primary","--primary-foreground","--ring","--accent","--accent-foreground","--sidebar-primary","--sidebar-primary-foreground","--chart-1","--chart-2","--chart-3","--chart-4","--chart-5"];

function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#0B0B0F" : "#FFFFFF";
}
function customVars(c: CustomColors): Record<string, string> {
  return {
    "--primary": c.primary, "--primary-foreground": readableOn(c.primary), "--ring": c.primary,
    "--accent": c.accent, "--accent-foreground": readableOn(c.accent),
    "--sidebar-primary": c.primary, "--sidebar-primary-foreground": readableOn(c.primary),
    "--chart-1": c.primary, "--chart-2": c.accent, "--chart-3": c.highlight,
    "--chart-4": `color-mix(in oklab, ${c.primary} 55%, ${c.highlight})`,
    "--chart-5": `color-mix(in oklab, ${c.accent} 55%, ${c.highlight})`,
  };
}
function loadCustom(): CustomColors {
  try { const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "null"); if (v?.primary && v?.accent && v?.highlight) return v; } catch { /* ignore */ }
  return DEFAULT_CUSTOM;
}
function clearCustomVars() { CUSTOM_VARS.forEach((k) => document.documentElement.style.removeProperty(k)); }
function applyCustom(c: CustomColors) {
  document.documentElement.removeAttribute("data-business-theme");
  Object.entries(customVars(c)).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

function isBusinessTheme(value: string | null): value is BusinessTheme {
  return BUSINESS_THEMES.some((theme) => theme.id === value);
}

function applyBusinessTheme(theme: BusinessTheme) {
  clearCustomVars();
  if (theme === "custom") return applyCustom(loadCustom());
  if (theme === "brand") document.documentElement.removeAttribute("data-business-theme");
  else document.documentElement.dataset["businessTheme"] = theme;
}

export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}var b=localStorage.getItem('${THEME_STORAGE_KEY}');if(b==='cafe'||b==='coffeehouse'||b==='fiesta'){document.documentElement.setAttribute('data-business-theme',b)}if(b==='custom'){var c=JSON.parse(localStorage.getItem('${CUSTOM_KEY}')||'null');if(c&&/^#[0-9a-fA-F]{6}$/.test(c.primary)&&/^#[0-9a-fA-F]{6}$/.test(c.accent)&&/^#[0-9a-fA-F]{6}$/.test(c.highlight)){var L=function(h){var n=parseInt(h.slice(1),16);return (0.299*((n>>16)&255)+0.587*((n>>8)&255)+0.114*(n&255))>160?'#0B0B0F':'#FFFFFF'};var s=document.documentElement.style;s.setProperty('--primary',c.primary);s.setProperty('--primary-foreground',L(c.primary));s.setProperty('--ring',c.primary);s.setProperty('--accent',c.accent);s.setProperty('--accent-foreground',L(c.accent));s.setProperty('--sidebar-primary',c.primary);s.setProperty('--sidebar-primary-foreground',L(c.primary));s.setProperty('--chart-1',c.primary);s.setProperty('--chart-2',c.accent);s.setProperty('--chart-3',c.highlight);s.setProperty('--chart-4','color-mix(in oklab, '+c.primary+' 55%, '+c.highlight+')');s.setProperty('--chart-5','color-mix(in oklab, '+c.accent+' 55%, '+c.highlight+')')}}}catch(e){}})()`;

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
    <div className="space-y-5">
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
    <CustomThemeBuilder active={selected === "custom"} onApply={() => setSelected("custom")} />
    </div>
  );
}

function CustomThemeBuilder({ active, onApply }: { active: boolean; onApply: () => void }) {
  const { t } = useT();
  const [colors, setColors] = useState<CustomColors>(DEFAULT_CUSTOM);
  const [slot, setSlot] = useState<keyof CustomColors>("primary");
  useEffect(() => setColors(loadCustom()), []);

  const update = (next: CustomColors) => {
    setColors(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    localStorage.setItem(THEME_STORAGE_KEY, "custom");
    clearCustomVars();
    applyCustom(next);
    onApply();
  };
  const slots: { id: keyof CustomColors; label: string }[] = [
    { id: "primary", label: t("theme.custom.primary") },
    { id: "accent", label: t("theme.custom.accent") },
    { id: "highlight", label: t("theme.custom.highlight") },
  ];

  return (
    <div className={`rounded-lg border p-4 ${active ? "border-primary ring-2 ring-primary" : "border-border"}`}>
      <h3 className="font-semibold text-foreground">{t("theme.custom.title")}</h3>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{t("theme.custom.description")}</p>
      <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("theme.custom.title")}>
        {slots.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={slot === s.id}
            onClick={() => setSlot(s.id)}
            className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium text-foreground ${slot === s.id ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <span className="h-7 w-7 rounded-full border border-border" style={{ background: colors[s.id] }} aria-hidden />
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" aria-label={t("theme.custom.palette")}>
        {CUSTOM_PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            aria-pressed={colors[slot].toUpperCase() === hex}
            onClick={() => update({ ...colors, [slot]: hex })}
            className={`aspect-square w-full rounded-full border-2 transition hover:scale-110 ${colors[slot].toUpperCase() === hex ? "border-foreground ring-2 ring-ring" : "border-border"}`}
            style={{ background: hex }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          {t("theme.custom.any")}
          <input type="color" value={colors[slot]} onChange={(e) => update({ ...colors, [slot]: e.target.value.toUpperCase() })} className="h-9 w-12 cursor-pointer rounded border border-input bg-background" />
        </label>
        <Button type="button" size="sm" onClick={() => update(colors)}>{t("theme.custom.apply")}</Button>
      </div>
    </div>
  );
}
