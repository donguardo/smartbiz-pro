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
