import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";

type LegalSection = { title: string; body: string };

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="border-b border-border bg-primary/30 backdrop-blur-md">
        <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        <p className="font-mono text-xs uppercase text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <p className="mt-8 max-w-3xl text-base leading-7 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/" className="font-semibold text-primary">Back to home</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy Notice</Link>
          <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          <Link to="/delete-account" className="hover:text-foreground">Delete your account</Link>
        </div>
      </main>
    </div>
  );
}