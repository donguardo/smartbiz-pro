import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPeso } from "@/lib/admin-format";
import { useServerFn } from "@tanstack/react-start";
import { adminDecideCancellation } from "@/utils/cancellation.functions";

// Platform Super Admin (view-only). Served on admin.mvp.com.ai; hidden on the shop app's public hosts.
// Allowlist is managed by SQL only — see AGENTS.md / README "Platform admins".
const SHOP_HOSTS = ["mvp.com.ai", "www.mvp.com.ai", "smartbiz-pro.lovable.app"];

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Platform Admin — MVP BizManager" },
      { name: "description", content: "Restricted platform administration for MVP BizManager." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Platform Admin — MVP BizManager" },
      { property: "og:description", content: "Restricted area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Stage = "loading" | "signin" | "forbidden" | "enroll" | "challenge" | "ready";

function AdminPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [hidden, setHidden] = useState(false);

  const evaluate = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setStage("signin");
    const { data: ok, error } = await supabase.rpc("is_platform_admin");
    if (error || !ok) {
      await supabase.auth.signOut();
      return setStage("forbidden");
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return setStage("ready");
    const { data: factors } = await supabase.auth.mfa.listFactors();
    setStage(factors?.totp?.some((f) => f.status === "verified") ? "challenge" : "enroll");
  }, []);

  useEffect(() => {
    if (SHOP_HOSTS.includes(window.location.hostname)) { setHidden(true); return; }
    evaluate();
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "MFA_CHALLENGE_VERIFIED") evaluate();
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate]);

  if (hidden) return <Center><h1 className="text-2xl font-bold">Page not found</h1></Center>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-bold">MVP BizManager · Platform Admin</span>
        {stage !== "signin" && stage !== "forbidden" && stage !== "loading" && (
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        )}
      </header>
      {stage === "loading" && <Center><p className="text-muted-foreground">Checking access…</p></Center>}
      {stage === "signin" && <SignIn />}
      {stage === "forbidden" && <Forbidden onBack={() => setStage("signin")} />}
      {stage === "enroll" && <Enroll onDone={evaluate} />}
      {stage === "challenge" && <Challenge onDone={evaluate} />}
      {stage === "ready" && <Dashboard onDenied={evaluate} />}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70vh] items-center justify-center p-4"><div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">{children}</div></div>;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Center>
      <h1 className="text-xl font-bold">Platform admin sign-in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Authorized administrators only.</p>
      <form className="mt-5 space-y-3 text-left" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErr(error.message);
        setBusy(false);
      }}>
        <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
      </form>
    </Center>
  );
}

function Forbidden({ onBack }: { onBack: () => void }) {
  return (
    <Center>
      <p className="font-mono text-sm text-destructive">403</p>
      <h1 className="text-xl font-bold">Not authorized</h1>
      <p className="mt-2 text-sm text-muted-foreground">This account doesn't have platform admin access. You've been signed out.</p>
      <Button className="mt-4" variant="outline" onClick={onBack}>Back to sign-in</Button>
    </Center>
  );
}

function Enroll({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `admin-${Date.now()}` });
      if (error) return setErr(error.message);
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);
  return (
    <Center>
      <h1 className="text-xl font-bold">Set up two-factor authentication</h1>
      <p className="mt-1 text-sm text-muted-foreground">Scan with an authenticator app, then enter the 6-digit code.</p>
      {factor && <>
        <img src={factor.qr} alt="Authenticator QR code" className="mx-auto mt-4 h-44 w-44 rounded bg-card" />
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{factor.secret}</p>
      </>}
      <CodeForm code={code} setCode={setCode} err={err} onSubmit={async () => {
        if (!factor) return;
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
        if (error) setErr(error.message); else onDone();
      }} />
    </Center>
  );
}

function Challenge({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Center>
      <h1 className="text-xl font-bold">Two-factor check</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter the code from your authenticator app.</p>
      <CodeForm code={code} setCode={setCode} err={err} onSubmit={async () => {
        const { data } = await supabase.auth.mfa.listFactors();
        const f = data?.totp?.find((x) => x.status === "verified");
        if (!f) return setErr("No authenticator found");
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code });
        if (error) setErr(error.message); else onDone();
      }} />
    </Center>
  );
}

function CodeForm({ code, setCode, err, onSubmit }: { code: string; setCode: (s: string) => void; err: string | null; onSubmit: () => Promise<void> }) {
  return (
    <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); await onSubmit(); }}>
      <Input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center font-mono tracking-widest" />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full">Verify</Button>
    </form>
  );
}

type Data = {
  totals: { shops: number; users: number; sales_count: number; sales_total: number } | null;
  signups: { day: string; signups: number }[];
  shops: { shop_id: string; shop_name: string; created_at: string; owner_email: string | null; staff_count: number }[];
  runs: { id: string; job: string; status: string; started_at: string; finished_at: string | null; shops_processed: number; error: string | null }[];
  deletions: { deleted_on: string; deletions: number }[];
};

function Dashboard({ onDenied }: { onDenied: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    (async () => {
      const [t, s, sh, r, del] = await Promise.all([
        supabase.rpc("admin_platform_totals"), supabase.rpc("admin_signups_by_day"), supabase.rpc("admin_shop_list"),
        supabase.rpc("admin_refresh_runs"), supabase.rpc("admin_account_deletions"),
      ]);
      if ([t, s, sh, r, del].some((x) => x.error)) return onDenied();
      setD({ totals: (t.data as Data["totals"][])?.[0] ?? null, signups: s.data as Data["signups"], shops: sh.data as Data["shops"], runs: r.data as Data["runs"], deletions: del.data as Data["deletions"] });
    })();
  }, [onDenied]);
  if (!d) return <Center><p className="text-muted-foreground">Loading…</p></Center>;
  const maxSignups = Math.max(1, ...d.signups.map((x) => Number(x.signups)));
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Shops", d.totals?.shops], ["Users", d.totals?.users], ["Sales", d.totals?.sales_count], ["Sales amount", formatPeso(Number(d.totals?.sales_total ?? 0))]].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="mt-1 text-2xl font-bold">{String(v ?? 0)}</p></div>
        ))}
      </section>
      <CancellationRequests />
      <Panel title="New signups (last 30 days)">
        <div className="flex h-32 items-end gap-1">
          {d.signups.map((x) => <div key={x.day} title={`${x.day}: ${x.signups}`} className="flex-1 rounded-t bg-primary" style={{ height: `${(Number(x.signups) / maxSignups) * 100}%`, minHeight: 2 }} />)}
        </div>
      </Panel>
      <Panel title={`Shops (${d.shops.length})`}>
        <Table head={["Shop", "Owner email", "Staff", "Created"]} rows={d.shops.map((s) => [s.shop_name, s.owner_email ?? "—", String(s.staff_count), new Date(s.created_at).toLocaleDateString()])} />
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Refresh job health">
          <Table head={["Started", "Status", "Shops", "Error"]} rows={d.runs.map((r) => [new Date(r.started_at).toLocaleString(), r.status, String(r.shops_processed), r.error ?? "—"])} />
        </Panel>
        <Panel title="Account deletions">
          <Table head={["Date", "Deletions"]} rows={d.deletions.map((x) => [x.deleted_on, String(x.deletions)])} />
        </Panel>
      </div>
    </main>
  );
}

type CancelReq = { id: string; status: string; reason: string | null; admin_note: string | null; created_at: string; decided_at: string | null; owner_email: string | null; shop_names: string | null; plan: string | null; period_end: string | null };

function CancellationRequests() {
  const decide = useServerFn(adminDecideCancellation);
  const [rows, setRows] = useState<CancelReq[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_cancellation_requests");
    if (error) return setErr("Could not load cancel requests");
    setRows(data as CancelReq[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const act = async (id: string, decision: "approved" | "contacted") => {
    if (decision === "contacted" && !notes[id]?.trim()) return setErr("Write a message to the owner first.");
    if (decision === "approved" && !window.confirm("Approve? The plan will end at the end of its paid month.")) return;
    setBusy(id); setErr(null);
    const r = await decide({ data: { id, decision, note: notes[id] } });
    if ("error" in r) setErr(r.error);
    setBusy(null); void load();
  };
  const open = rows?.filter((r) => r.status === "pending" || r.status === "contacted") ?? [];
  const done = rows?.filter((r) => !open.includes(r)) ?? [];
  return (
    <Panel title={`Cancel requests${open.length ? ` — ${open.length} waiting` : ""}`}>
      {err && <p className="mb-2 text-sm text-destructive">{err}</p>}
      {!rows ? <p className="text-sm text-muted-foreground">Loading…</p> : !open.length ? <p className="text-sm text-muted-foreground">No open requests.</p> : (
        <div className="space-y-3">
          {open.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border border-primary p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{r.shop_names ?? "—"} · {r.owner_email ?? "—"}</p>
                <span className="rounded-full bg-primary/15 px-2 text-xs text-primary">{r.status === "contacted" ? "Waiting for owner" : "New"}</span>
              </div>
              <p className="text-muted-foreground">Plan: {r.plan ?? "—"} · paid until {r.period_end ? new Date(r.period_end).toLocaleDateString() : "—"} · asked {new Date(r.created_at).toLocaleString()}</p>
              <p>Reason: {r.reason ?? "(none given)"}</p>
              {r.admin_note && <p className="text-muted-foreground">Your message: {r.admin_note}</p>}
              <Input placeholder="Message to the owner (e.g. an offer to stay)" maxLength={1000} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "approved")}>Approve cancel</Button>
                <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "contacted")}>Reach out instead</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && <div className="mt-4"><Table head={["Shop", "Owner", "Result", "Date"]} rows={done.map((r) => [r.shop_names ?? "—", r.owner_email ?? "—", ({ approved: "Approved", withdrawn: "Owner kept plan", owner_cancelled: "Owner cancelled anyway" } as Record<string, string>)[r.status] ?? r.status, new Date(r.decided_at ?? r.created_at).toLocaleDateString()])} /></div>}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr>{head.map((h) => <th key={h} className="border-b border-border py-2 pr-3 text-left text-xs uppercase text-muted-foreground">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-border py-2 pr-3">{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
