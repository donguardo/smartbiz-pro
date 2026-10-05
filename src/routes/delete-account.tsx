import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";
import { LanguageToggle, useT } from "@/lib/i18n";

export const SUPPORT_EMAIL = "support@mvp.com.ai";

export const Route = createFileRoute("/delete-account")({
  head: () => ({ meta: [
    { title: "Delete your account — MVP BizManager" },
    { name: "description", content: "How to delete your MVP BizManager account and data, in the app or by email." },
    { property: "og:title", content: "Delete your account — MVP BizManager" },
    { property: "og:description", content: "Steps to delete your MVP BizManager account and the data linked to it." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { t } = useT();
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="border-b border-border bg-primary/30 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3"><Logo /><div className="flex gap-2"><LanguageToggle /><ThemeToggle /></div></div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:py-16">
        <h1 className="text-3xl font-bold sm:text-5xl">{t("account.pageTitle")}</h1>
        <section><h2 className="text-xl font-semibold">{t("account.pageInApp")}</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground"><li>{t("account.step1")}</li><li>{t("account.step2")}</li><li>{t("account.step3")}</li><li>{t("account.step4")}</li></ol></section>
        <section><h2 className="text-xl font-semibold">{t("account.pageWhat")}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground"><li>{t("account.whatLogin")}</li><li>{t("account.whatCashier")}</li><li>{t("account.wholeShop")}</li><li>{t("account.pageAudit")}</li></ul></section>
        <section><h2 className="text-xl font-semibold">{t("account.pageNoApp")}</h2>
          <p className="mt-3 text-muted-foreground">{t("account.pageEmail")} <a className="font-semibold text-primary underline" href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}>{SUPPORT_EMAIL}</a></p></section>
        <div className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm"><Link to="/" className="font-semibold text-primary">MVP BizManager</Link><Link to="/privacy">Privacy Notice</Link><Link to="/terms">Terms of Service</Link></div>
      </main>
    </div>
  );
}
