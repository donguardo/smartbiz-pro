import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Bot, Check, CreditCard, PackageSearch, QrCode, ScanLine, Smartphone, UserPlus, Store, Receipt } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";
import { DemoDashboard } from "@/components/DemoDashboard";
import { PRICE_PER_USER } from "@/lib/format";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BizManager.ai — MAS KITA, MAS TUBO! | ₱499/user" },
      { name: "description", content: "Run your store with a fast POS register, live dashboards and an AI copilot that flags reorders and dead stock. ₱499 per user per month." },
      { property: "og:title", content: "BizManager.ai — MAS KITA, MAS TUBO!" },
      { property: "og:description", content: "POS checkout, inventory insights and an AI business copilot. Try the live demo, no login." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { icon: UserPlus, title: "Create your account", body: "Sign up with email or Google in under a minute. Name your store — that's it." },
  { icon: Store, title: "Add your products", body: "Add items with price, cost and stock, or load a sample catalog to explore." },
  { icon: ScanLine, title: "Ring up sales", body: "Scan or search barcodes, take Cash, GCash/Maya QR or Card, and print receipts." },
  { icon: Bot, title: "Ask your AI manager", body: "Get reorder alerts, dead-stock warnings and plain answers about how your store is doing." },
];

function Landing() {
  const [step, setStep] = useState(0);
  const S = STEPS[step]!;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <a href="#demo" className="hover:text-foreground">Live demo</a>
            <a href="#setup" className="hover:text-foreground">Setup guide</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Get started</Link>
          </div>
        </div>
      </header>

      <section className="grid-paper relative overflow-hidden">
        <AnimatedBackdrop />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> POS · Inventory · AI Copilot
            </span>
            <p className="mt-6 font-display text-5xl font-bold uppercase leading-none md:text-7xl"><span className="text-white">MAS KITA,</span><br /><span className="text-primary">MAS TUBO!</span></p>
            <h1 className="mt-5 max-w-xl text-2xl font-semibold leading-tight md:text-4xl">
              Your store's register<br />with a <span className="text-primary">business manager</span> built in.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Ring up sales, watch profit move in real time, and let an AI copilot tell you what to reorder, what's not selling, and how this week compares.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">
                Start for ₱{PRICE_PER_USER}/user <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#demo" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-semibold hover:bg-muted">Try the demo</a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Smartphone className="h-4 w-4" /> Installs on Android & iPhone from your browser.</p>
          </div>

          <div className="relative z-10">
            <div className="receipt-edge rounded-t-2xl bg-card p-6 font-mono text-sm shadow-2xl shadow-primary/10">
              <p className="text-center font-semibold">SARI-SARI PLUS</p>
              <p className="text-center text-xs text-muted-foreground">Receipt #000482</p>
              <div className="my-4 border-t border-dashed border-border" />
              {[["Coke 1.5L ×2", "150.00"], ["Piattos Cheese ×3", "105.00"], ["Safeguard Bar", "48.00"]].map(([a, b]) => (
                <div key={a} className="flex justify-between py-1"><span>{a}</span><span>{b}</span></div>
              ))}
              <div className="my-4 border-t border-dashed border-border" />
              <div className="flex justify-between font-semibold"><span>TOTAL</span><span>₱303.00</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GCash QR</span><span>PAID</span></div>
              <div className="mt-6 rounded-xl bg-ink p-4 font-sans text-ink-foreground">
                <p className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70"><Bot className="h-3.5 w-3.5" /> AI Manager</p>
                <p className="mt-2 text-sm">Coke 1.5L will run out in ~2 days at this pace. Reorder 24 units today.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Interactive demo · no login</p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Change a number. Watch the charts follow.</h2>
          <p className="mt-2 text-muted-foreground">This is the same dashboard you'll get, running on sample numbers.</p>
        </div>
        <DemoDashboard />
      </section>

      <section id="setup" className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Setup walkthrough</p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Selling in four steps</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-[280px_1fr]">
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <button onClick={() => setStep(i)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${i === step ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs ${i < step ? "bg-success text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="font-medium">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-8">
              <div>
                <S.icon className="h-10 w-10 text-primary" />
                <p className="mt-4 font-mono text-xs text-muted-foreground">STEP {step + 1} OF 4</p>
                <h3 className="mt-1 text-2xl font-bold">{S.title}</h3>
                <p className="mt-3 max-w-lg text-muted-foreground">{S.body}</p>
                {step === 2 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {[{ i: Receipt, l: "Cash" }, { i: QrCode, l: "GCash / Maya QR" }, { i: CreditCard, l: "Card" }].map(({ i: I, l }) => (
                      <span key={l} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><I className="h-4 w-4" />{l}</span>
                    ))}
                  </div>
                )}
                {step === 3 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["What should I reorder?", "Which items aren't selling?", "How did this week go?"].map((q) => (
                      <span key={q} className="rounded-full bg-muted px-3 py-1.5 text-sm">{q}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-8 flex gap-2">
                <button disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-40">Back</button>
                {step < 3 ? (
                  <button onClick={() => setStep(step + 1)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Next</button>
                ) : (
                  <Link to="/auth" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create my store</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 md:grid-cols-3">
        {[
          { icon: ScanLine, t: "Fast checkout", b: "Scan barcodes, adjust quantities, take any payment and generate a receipt in seconds." },
          { icon: PackageSearch, t: "Inventory that watches itself", b: "Low-stock and dead-stock flags calculated from your actual sales." },
          { icon: Bot, t: "AI copilot", b: "Ask in plain words. Get answers from your own sales and stock data." },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border border-border bg-card p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.b}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-ink p-8 text-ink-foreground md:grid-cols-2 md:p-12">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest opacity-70">One simple plan</p>
            <p className="mt-3 font-display text-6xl font-bold">₱{PRICE_PER_USER}<span className="text-xl font-medium opacity-70">/user/month</span></p>
            <p className="mt-3 opacity-80">Everything included. Add cashiers as you grow.</p>
            <Link to="/auth" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Create my account <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <ul className="space-y-3">
            {["POS register with Cash, QR e-wallet & Card", "Printable digital receipts", "Live revenue & margin dashboard", "Inventory with reorder alerts", "AI Business Manager copilot", "Works on desktop, Android & iPhone"].map((f) => (
              <li key={f} className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" />{f}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} BizManager.ai · MAS KITA, MAS TUBO! · by Orangeware USA</footer>
    </div>
  );
}
