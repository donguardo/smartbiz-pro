import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";

// Opened by the Android app in a Chrome Custom Tab (Google blocks sign-in inside WebViews).
export const Route = createFileRoute("/app-login")({
  head: () => ({
    meta: [
      { title: "Signing in — MVP BizManager" },
      { name: "description", content: "Google sign-in for the MVP BizManager Android app." },
      { property: "og:title", content: "Signing in — MVP BizManager" },
      { property: "og:description", content: "Google sign-in for the MVP BizManager Android app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLogin,
});

function AppLogin() {
  const [err, setErr] = useState(false);
  useEffect(() => {
    void lovable.auth
      .signInWithOAuth("google", { redirect_uri: window.location.origin + "/app-callback" })
      .then((r) => {
        if (r.error) setErr(true);
        else if (!r.redirected) window.location.replace("/app-callback");
      });
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-foreground">
      {err ? "Google sign-in failed. Close this window and try again." : "Opening Google sign-in…"}
    </div>
  );
}
