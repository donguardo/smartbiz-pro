import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const APP_SCHEME = "mvpbizmanager://auth-callback";

// Runs in the Custom Tab after Google: hands the session back to the Android app.
export const Route = createFileRoute("/app-callback")({
  head: () => ({
    meta: [
      { title: "Returning to app — MVP BizManager" },
      { name: "description", content: "Returning to the MVP BizManager Android app after sign-in." },
      { property: "og:title", content: "Returning to app — MVP BizManager" },
      { property: "og:description", content: "Returning to the MVP BizManager Android app after sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppCallback,
});

function AppCallback() {
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let done = false;
    const send = (s: { access_token: string; refresh_token: string } | null) => {
      if (!s || done) return;
      done = true;
      const url = `${APP_SCHEME}#${new URLSearchParams({ access_token: s.access_token, refresh_token: s.refresh_token })}`;
      // Sign this browser out so the session lives only in the app.
      void supabase.auth.signOut({ scope: "local" });
      setLink(url);
      window.location.replace(url);
    };
    const { data } = supabase.auth.onAuthStateChange((_e, s) => send(s));
    void supabase.auth.getSession().then(({ data: d }) => send(d.session));
    const t = setTimeout(() => { if (!done) setErr(true); }, 15000);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-foreground">
      {err ? <p>Sign-in didn't finish. Close this window and try again.</p> : <p>Returning to MVP BizManager…</p>}
      {link && <a className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href={link}>Open the app</a>}
    </div>
  );
}
