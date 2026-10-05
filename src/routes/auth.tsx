import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";
import { PRICE_PER_USER } from "@/lib/format";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";
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

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://mvp.com.ai/reset-password" });
        if (error) console.warn("Password reset request was not accepted", error.message);
        setMessage({ kind: "success", text: "If that email has an account, we've sent a reset link." });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { business_name: business || "My Store" } },
        });
        if (error) throw error;
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
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in failed. Please try again.");
  };

  return (
    <div className="grid-paper relative flex min-h-screen flex-col overflow-x-hidden">
      <AnimatedBackdrop />
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
            {mode === "signup" && (
              <Input placeholder="Business name" value={business} onChange={(e) => setBusiness(e.target.value)} />
            )}
            <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            {mode !== "forgot" && <>
              <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {mode === "signin" && <button type="button" onClick={() => { setMode("forgot"); setMessage(null); }} className="block text-sm font-semibold text-primary hover:underline">Forgot password?</button>}
            </>}
            {message && <p role="status" className={message.kind === "success" ? "rounded-lg bg-success/10 p-3 text-sm text-success" : "rounded-lg bg-destructive/10 p-3 text-sm text-destructive"}>{message.text}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </Button>
          </form>
          {mode === "signup" && <p className="mt-3 text-center text-xs text-muted-foreground">By creating an account, you agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and acknowledge the <Link to="/privacy" className="text-primary hover:underline">Privacy Notice</Link>.</p>}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remembered your password?" : "New here?"}{" "}
            <button onClick={() => { setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup"); setMessage(null); }} className="font-semibold text-primary">
              {mode === "signup" ? "Sign in" : mode === "forgot" ? "Back to sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
