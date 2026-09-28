import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DICT, fallback, type Lang } from "./i18n-dict";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [strings, setStrings] = useState<Record<Lang, Record<string, string>>>({ en: fallback("en"), tl: fallback("tl") });

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "tl") setLangState(saved);
    // Load live translations from the backend
    supabase.from("translations").select("key, lang, value").then(({ data }) => {
      if (!data) return;
      setStrings((prev) => {
        const next = { en: { ...prev.en }, tl: { ...prev.tl } };
        for (const r of data) if (r.lang === "en" || r.lang === "tl") next[r.lang][r.key] = r.value;
        return next;
      });
    });
    // Apply signed-in user's saved preference
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("language").eq("id", data.user.id).maybeSingle();
      if (p?.language === "en" || p?.language === "tl") { setLangState(p.language); localStorage.setItem("lang", p.language); }
    });
  }, []);

  useEffect(() => { document.documentElement.lang = lang === "tl" ? "tl" : "en"; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from("profiles").update({ language: l }).eq("id", data.user.id).then(() => {});
    });
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = strings[lang][key] ?? DICT[key]?.en ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  }, [lang, strings]);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

// Safe default: if the provider is momentarily missing (e.g. after a hot reload
// swaps the context instance), render English fallback text instead of crashing.
const FALLBACK_EN = fallback("en");
const DEFAULT_CTX: Ctx = {
  lang: "en",
  setLang: () => {},
  t: (key, vars) => {
    let s = FALLBACK_EN[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  },
};

export function useT() {
  return useContext(I18nCtx) ?? DEFAULT_CTX;
}

function FlagPH() {
  return (
    <svg viewBox="0 0 30 15" className="h-3.5 w-6 rounded-[2px]" aria-hidden>
      <rect width="30" height="7.5" fill="#0038A8" /><rect y="7.5" width="30" height="7.5" fill="#CE1126" />
      <polygon points="0,0 13,7.5 0,15" fill="#FFFFFF" /><circle cx="4.3" cy="7.5" r="1.6" fill="#FCD116" />
    </svg>
  );
}
function FlagUS() {
  return (
    <svg viewBox="0 0 38 20" className="h-3.5 w-6 rounded-[2px]" aria-hidden>
      {Array.from({ length: 13 }).map((_, i) => <rect key={i} y={(i * 20) / 13} width="38" height={20 / 13} fill={i % 2 ? "#FFFFFF" : "#B22234"} />)}
      <rect width="15.2" height={(20 / 13) * 7} fill="#3C3B6E" />
    </svg>
  );
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useT();
  const opts: { l: Lang; label: string; Flag: () => ReactNode }[] = [
    { l: "en", label: "English", Flag: FlagUS },
    { l: "tl", label: "Tagalog", Flag: FlagPH },
  ];
  return (
    <div role="group" aria-label={t("lang.label")} className={`inline-flex h-9 items-center rounded-lg border border-border bg-card p-0.5 ${className}`}>
      {opts.map(({ l, label, Flag }) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} title={label} aria-label={label}
          className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition ${lang === l ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
          <Flag /><span className="hidden sm:inline">{l.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
