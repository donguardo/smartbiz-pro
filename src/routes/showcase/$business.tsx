import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ShowcaseDashboard } from "@/components/ShowcaseDashboard";
import { ShowcaseHeader } from "@/components/ShowcaseHeader";
import { getShowcaseScenario } from "@/lib/showcase-scenarios";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/showcase/$business")({
  loader: ({ params }) => {
    const scenario = getShowcaseScenario(params.business);
    if (!scenario) throw notFound();
    return scenario.slug;
  },
  head: ({ loaderData }) => {
    const scenario = loaderData ? getShowcaseScenario(loaderData) : undefined;
    if (!scenario) return { meta: [{ title: "Dashboard unavailable — MVP BizManager" }, { name: "robots", content: "noindex" }] };
    return { meta: [
      { title: `${scenario.sampleName} ${scenario.name.en} Dashboard — MVP BizManager` },
      { name: "description", content: `${scenario.story.en} Explore its interactive sales, profit, category, and operations dashboard.` },
      { property: "og:title", content: `${scenario.name.en} Dashboard Preview — MVP BizManager` },
      { property: "og:description", content: scenario.customer.en },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: BusinessShowcase,
});

function BusinessShowcase() {
  const slug = Route.useLoaderData();
  const scenario = getShowcaseScenario(slug);
  const { lang, t } = useT();
  if (!scenario) return null;
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <ShowcaseHeader backToGallery />
      <main className="mx-auto max-w-7xl px-3 py-8 sm:px-4 md:py-12">
        <div className="mb-8 grid gap-6 md:grid-cols-[1fr_360px] md:items-end">
          <div><p className="font-mono text-xs uppercase tracking-widest text-primary">{scenario.name[lang]} · {t("showcase.sample")}</p><h1 className="mt-2 text-4xl font-bold md:text-6xl">{scenario.sampleName}</h1><p className="mt-4 max-w-3xl text-lg text-muted-foreground">{scenario.story[lang]}</p></div>
          <div data-business-theme={scenario.theme} className="showcase-theme rounded-lg border border-border bg-card p-5"><p className="text-xs font-semibold uppercase text-primary">{t("showcase.goodFor")}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{scenario.customer[lang]}</p></div>
        </div>
        <ShowcaseDashboard scenario={scenario} />
        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-lg border border-border bg-card p-6 text-center sm:flex-row sm:text-left"><div><h2 className="text-xl font-bold">{t("showcase.yoursTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("showcase.yoursBody")}</p></div><Link to="/auth" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">{t("cta.getStarted")}<ArrowRight className="h-4 w-4" /></Link></div>
      </main>
    </div>
  );
}