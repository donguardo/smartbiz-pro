<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use React Three Fiber for decorative 3D scenes so renderer lifecycle, resize, and cleanup stay React-managed.
- UI wording lives in the backend translations table (key, lang en/tl); src/lib/i18n-dict.ts is the offline fallback and seed source — keeps copy editable without code changes.
- BIZBOT uses one browser-local AI SDK UIMessage conversation and a global floating client — matching the chosen single-device chat experience.
- The opening video is browser-local first-visit onboarding and emits completion before the install prompt — prevents overlapping first-run experiences.
- Installation state and reopening use the shared browser event in src/lib/install.ts — keeps public and signed-in navigation synchronized with one install window.
- All server responses set X-Frame-Options DENY and CSP frame-ancestors none — prevents clickjacking by disallowing third-party framing.
- Account deletion runs in a requireSupabaseAuth server function that re-verifies the user and calls a service-role-only SQL function; audit keeps only date + hashed id — keeps the service key server-side and PII out of logs.
