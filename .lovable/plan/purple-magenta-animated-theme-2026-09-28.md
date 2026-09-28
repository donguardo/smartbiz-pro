# Purple–Magenta Animated Theme

## What will change
- Replace the current orange-led palette with a balanced purple and magenta system in light and dark modes.
- Add a subtle Three.js animated mesh background to the landing and sign-in screens.
- Keep cards, charts, text, and workspace controls high-contrast and readable.
- Respect reduced-motion settings and keep the animation decorative and non-interactive.

## Technical details
- Centralize all new colors in the existing semantic theme tokens.
- Build one reusable, client-only Three.js canvas that cleans up its renderer and animation loop.
- Layer the canvas behind page content without affecting clicks, scrolling, or layout.
- Verify the public page and workspace at desktop and mobile sizes.
