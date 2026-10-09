import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";

export type LegalSection = {
  title: string;
  /** One or more paragraphs; separate paragraphs with a blank line. */
  body: string;
  /** Optional bulleted list rendered after the paragraphs. */
  items?: string[];
  /** Optional inline link rendered after the paragraphs/list. */
  link?: { to: string; label: string };
  email?: string;
};

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-10 sm:pb-28 sm:pt-16">
        <p className="font-mono text-xs uppercase text-primary">Legal</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <p className="mt-8 max-w-3xl text-base leading-7 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              {section.body.split("\n\n").map((para, i) => (
                <p key={i} className="mt-3 max-w-3xl leading-7 text-muted-foreground">{para}</p>
              ))}
              {section.items && (
                <ul className="mt-3 max-w-3xl list-disc space-y-1.5 pl-5 leading-7 text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.link && <Link className="mt-3 inline-block font-semibold text-primary underline" to={section.link.to}>{section.link.label}</Link>}
              {section.email && <a className="mt-2 inline-block font-semibold text-primary underline" href={`mailto:${section.email}`}>{section.email}</a>}
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
