import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Loaded inside the Android WebView with the tokens in the #hash; signs the WebView in.
export const Route = createFileRoute("/app-return")({
  head: () => ({
    meta: [
      { title: "Signing you in — MVP BizManager" },
      { name: "description", content: "Finishing sign-in in the MVP BizManager app." },
      { property: "og:title", content: "Signing you in — MVP BizManager" },
      { property: "og:description", content: "Finishing sign-in in the MVP BizManager app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppReturn,
});

function AppReturn() {
  const [err, setErr] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", "/app-return");
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    if (!access_token || !refresh_token) { setErr(true); return; }
    void supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) setErr(true);
      else window.location.replace("/dashboard");
    });
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-foreground">
      {err ? <a href="/auth" className="underline">Sign-in failed — tap to try again</a> : "Signing you in…"}
    </div>
  );
}
