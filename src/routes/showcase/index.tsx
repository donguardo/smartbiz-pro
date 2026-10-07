import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { ArrowRight, FolderOpen } from "lucide-react";
import { ShowcaseHeader } from "@/components/ShowcaseHeader";
import { SHOWCASE_SCENARIOS } from "@/lib/showcase-scenarios";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/showcase/")({
  head: () => ({ ...seo("/showcase"), meta: [
    { title: "Business Dashboard Showcase — MVP BizManager" },
    { name: "description", content: "Preview interactive MVP BizManager dashboards for coffee shops, laundries, beauty parlors, cafés, and restaurants." },
    { property: "og:title", content: "Business Dashboard Showcase — MVP BizManager" },
    { property: "og:description", content: "Explore five interactive sample dashboards made for Philippine small businesses." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ShowcaseGallery,
});

function ShowcaseGallery() {
  const { lang, t } = useT();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShowcaseHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:py-20">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">{t("showcase.kicker")}</p>
          <h1 className="mt-3 text-4xl font-bold md:text-6xl">{t("showcase.title")}</h1>
          <p className="mt-5 text-lg text-muted-foreground">{t("showcase.description")}</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SHOWCASE_SCENARIOS.map((scenario) => (
            <article key={scenario.slug} data-business-theme={scenario.theme} className="showcase-theme group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-center justify-between bg-primary p-6 text-primary-foreground">
                <FolderOpen className="h-8 w-8" />
                <scenario.icon className="h-12 w-12 opacity-75" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="font-mono text-xs uppercase text-primary">{scenario.name[lang]}</p>
                <h2 className="mt-1 text-2xl font-bold">{scenario.sampleName}</h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{scenario.story[lang]}</p>
                <div className="mt-6 flex gap-2" aria-hidden>{["var(--primary)", "var(--chart-3)", "var(--chart-4)"].map((color) => <i key={color} className="h-3 w-10 rounded-full" style={{ background: color }} />)}</div>
                <Link to="/showcase/$business" params={{ business: scenario.slug }} className="mt-6 inline-flex items-center justify-between rounded-lg border border-border px-4 py-3 font-semibold transition group-hover:border-primary group-hover:text-primary">{t("showcase.open")}<ArrowRight className="h-4 w-4" /></Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}