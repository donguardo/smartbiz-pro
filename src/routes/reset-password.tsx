import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Set a new password — MVP BizManager" },
    { name: "description", content: "Choose a new password for your MVP BizManager account." },
    { property: "og:title", content: "Set a new password — MVP BizManager" },
    { property: "og:description", content: "Securely choose a new MVP BizManager password." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const hasRecoveryHash = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    let active = true;
    setReady(hasRecoveryHash);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage({ kind: "error", text: "Use at least 8 characters for your new password." });
    if (password !== confirmPassword) return setMessage({ kind: "error", text: "The passwords do not match." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage({ kind: "error", text: error.message || "We could not update your password. Request a new reset link and try again." });
    setMessage({ kind: "success", text: "Password updated. Taking you to your dashboard…" });
    window.setTimeout(() => void navigate({ to: "/dashboard", replace: true }), 900);
  };

  return (
    <div className="grid-paper min-h-screen overflow-x-hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4"><Logo /><ThemeToggle /></header>
      <main className="mx-auto flex w-full max-w-md px-4 py-10">
        <section className="w-full rounded-lg border border-border bg-card p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose a secure password for MVP BizManager.</p>
          {!ready ? (
            <div role="alert" className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">This reset link is invalid or has expired. Request a new link from the sign-in page.</div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">New password<Input className="mt-2" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
              <label className="block text-sm font-medium">Confirm new password<Input className="mt-2" type="password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
              {message && <p role="status" className={message.kind === "success" ? "text-sm text-success" : "text-sm text-destructive"}>{message.text}</p>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Updating password…" : "Update password"}</Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}