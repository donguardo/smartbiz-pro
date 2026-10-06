import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";
import { PRICE_PER_USER } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MVP BizManager" },
      { name: "description", content: "Create your MVP BizManager account and start selling in minutes." },
      { property: "og:title", content: "Sign in — MVP BizManager" },
      { property: "og:description", content: "Create your store account in under a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [business, setBusiness] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  const submitting = useRef(false);
  const confirmed = useRef(false);

  // Read and immediately scrub auth tokens/errors from the address bar.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const err = hash.get("error_code") || query.get("error_code") || hash.get("error") || query.get("error");
    if (err) { setExpired(true); setMode("signin"); }
    if (query.get("confirmed") === "1" || hash.get("type") === "signup") confirmed.current = true;
    // Let the auth client read a fresh access token first; scrub everything else right away.
    if (err || !hash.get("access_token")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    document.title = mode === "signup" ? "Create account — MVP BizManager" : mode === "forgot" ? "Reset password — MVP BizManager" : "Sign in — MVP BizManager";
  }, [mode]);

  useEffect(() => {
    if (!session) return;
    if (window.location.hash || window.location.search) window.history.replaceState(null, "", window.location.pathname);
    if (confirmed.current) toast.success("Email confirmed — welcome to MVP BizManager");
    navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const resend = async () => {
    if (!email) { setMessage({ kind: "error", text: "Enter your email above, then tap resend." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth?confirmed=1` } });
    setBusy(false);
    setMessage(error ? { kind: "error", text: error.message } : { kind: "success", text: "A new confirmation link is on its way. Check your email." });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current || done) return;
    if (mode === "signup" && mobile && !/^09\d{9}$/.test(mobile)) { setMessage({ kind: "error", text: "Use the mobile format 09XXXXXXXXX." }); return; }
    submitting.current = true;
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://mvp.com.ai/reset-password" });
        setMessage({ kind: "success", text: "If that email has an account, we've sent a reset link." });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth?confirmed=1`, data: { business_name: business || "My Store", owner_name: ownerName.trim(), mobile, business_type: businessType } },
        });
        if (error) throw error;
        setDone(true);
        setBusiness(""); setOwnerName(""); setMobile(""); setBusinessType(""); setPassword("");
        if (!data.session) setMessage({ kind: "success", text: "Check your email to confirm your account, then sign in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      if (mode === "forgot") setMessage({ kind: "success", text: "If that email has an account, we've sent a reset link." });
      else setMessage({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };

  const google = async () => {
    // On the live site this redirects in the same tab; inside the editor
    // preview the helper uses a secure popup (Google can't load in frames).
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) {
      // Pop-up blocked or closed (editor preview): offer a one-tap retry,
      // which counts as a fresh click so browsers allow the pop-up.
      toast.error("Google sign-in didn't open. Allow pop-ups for this page, then tap Retry.", {
        action: { label: "Retry", onClick: () => { void google(); } },
        duration: 10000,
      });
      return;
    }
    if (r.redirected) return;
    window.location.assign("/dashboard");
  };

  return (
    <div className="grid-paper relative flex min-h-screen flex-col overflow-x-hidden">
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 sm:p-4"><Logo /><ThemeToggle /></div>
      <div className="relative z-10 flex flex-1 items-start justify-center p-4 pb-40 sm:items-center sm:pb-8">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <h1 className="text-2xl font-bold">{mode === "signup" ? "Create your MVP BizManager account" : mode === "forgot" ? "Reset your password" : "Welcome back to MVP BizManager"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? `One plan: ₱${PRICE_PER_USER} per user / month.` : mode === "forgot" ? "Enter your email and we'll send a secure reset link." : "Sign in to your register and dashboard."}
          </p>
          {mode !== "forgot" && <Button type="button" onClick={google} variant="outline" className="mt-6 w-full">
            <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continue with Google
          </Button>}
          {mode !== "forgot" && <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>}
          <form onSubmit={submit} className="space-y-3">
            {expired && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><p className="font-semibold">Link expired — send a new one</p><p className="mt-1">Enter your email below, then tap resend.</p><Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={resend}>Resend confirmation email</Button></div>}
            <fieldset disabled={done && mode === "signup"} className="space-y-3 disabled:opacity-60">
            {mode === "signup" && (<>
              <Input placeholder="Business name" value={business} onChange={(e) => setBusiness(e.target.value)} />
              <Input placeholder="Owner name" autoComplete="name" maxLength={80} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              <Input type="tel" inputMode="numeric" placeholder="Mobile (09XXXXXXXXX)" pattern="09[0-9]{9}" maxLength={11} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} />
              <select aria-label="Business type" value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Business type</option>
                {["Sari-sari", "Food", "Retail", "Services", "Laundry", "Hardware", "Bakery", "Other"].map((b) => <option key={b}>{b}</option>)}
              </select>
            </>)}
            <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            {mode !== "forgot" && <>
              <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {mode === "signin" && <button type="button" onClick={() => { setMode("forgot"); setMessage(null); }} className="block text-sm font-semibold text-primary hover:underline">Forgot password?</button>}
            </>}
            {message && <p role="status" className={message.kind === "success" ? "rounded-lg bg-success/10 p-3 text-sm text-success" : "rounded-lg bg-destructive/10 p-3 text-sm text-destructive"}>{message.text}</p>}
            </fieldset>
            <Button type="submit" disabled={busy || (done && mode === "signup")} className="w-full">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </Button>
          </form>
          {mode === "signup" && <p className="mt-3 text-center text-xs text-muted-foreground">By creating an account, you agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and acknowledge the <Link to="/privacy" className="text-primary hover:underline">Privacy Notice</Link>.</p>}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remembered your password?" : "New here?"}{" "}
            <button onClick={() => { setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup"); setMessage(null); setDone(false); }} className="font-semibold text-primary">
              {mode === "signup" ? "Sign in" : mode === "forgot" ? "Back to sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
