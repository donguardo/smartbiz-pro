// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { readFile } from "node:fs/promises";
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifest, Plugin } from "vite";

const privatePage = /^\/(~oauth|api\/|auth|app-|reset-password|admin)/;
const heavySource = /(?:^|\/)node_modules\/(?:shiki|@shikijs|mermaid|@mermaid-js|katex|cytoscape)(?:\/|$)/;
// Shared chunks have no `src` in Vite's manifest; inspect their module origins too.
const heavyFiles = new Set<string>();
const precacheOrigins: Plugin = {
  name: "mvp-precache-origins",
  apply: "build",
  closeBundle() {
    // Vite's public-dir copy is disabled in this stack (nitro copies public/ into
    // dist/client after the Vite build), so the PWA's closeBundle glob never sees
    // offline.html/manifest.webmanifest/icons. Copy public/ into the client outDir
    // before VitePWA's closeBundle runs (this plugin registers first).
    cpSync(resolve("public"), resolve("dist/client"), { recursive: true });
  },
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk" && Object.keys(output.modules).some((id) => heavySource.test(id.replaceAll("\\", "/")))) {
        heavyFiles.add(output.fileName);
      }
    }
  },
};

async function precacheFiles() {
  const manifest: Manifest = JSON.parse(await readFile(resolve("dist/client/.vite/manifest.json"), "utf8"));
  const files = new Set<string>();
  const visited = new Set<string>();
  const excluded = (key: string) => {
    const source = (manifest[key]?.src ?? key).replaceAll("\\", "/");
    return heavySource.test(source) || heavyFiles.has(manifest[key]?.file ?? "")
      || (source.startsWith("src/routes/") && privatePage.test("/" + source.slice("src/routes/".length)));
  };
  const visit = (key: string) => {
    if (visited.has(key) || excluded(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    files.add(chunk.file.replace(/^client\//, ""));
    for (const css of chunk.css ?? []) files.add(css.replace(/^client\//, ""));
    // Only static dependencies: language/theme packs and renderers load on demand.
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  for (const [key, chunk] of Object.entries(manifest)) {
    const source = chunk.src ?? key;
    if (chunk.isEntry || /^src\/(?:routes|components|lib)\//.test(source)) visit(key);
  }
  for (const route of ["pos", "inventory", "dashboard"]) {
    const chunks = Object.entries(manifest).filter(([key, chunk]) =>
      new RegExp(`^src/routes/_app/${route}\\.tsx(?:\\?|$)`).test(chunk.src ?? key));
    if (!chunks.length || chunks.some(([, chunk]) => !files.has(chunk.file.replace(/^client\//, "")))) {
      throw new Error(`Required offline route missing from precache: ${route}`);
    }
  }
  return files;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: { manifest: true },
    // Email rendering needs entities v4 (hoisted); a nested newer copy lacks lib/decode.js.
    resolve: {
      alias: {
        "entities/lib/decode.js": resolve("node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": resolve("node_modules/entities/lib/encode.js"),
        entities: resolve("node_modules/entities"),
      },
    },
    plugins: [
      precacheOrigins,
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false,
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          modifyURLPrefix: { "client/": "" },
          manifestTransforms: [async (entries) => {
            const files = await precacheFiles();
            const seen = new Set<string>();
            const manifest = entries.filter((entry) => {
              const url = entry.url.replace(/^\/?client\//, "").replace(/^\//, "");
              const keep = /^(?:offline\.html|manifest\.webmanifest|favicon\.(?:png|ico)|apple-touch-icon\.png|icon(?:-maskable)?-(?:192|512)\.png)$/.test(url)
                || url.endsWith(".css") || (url.endsWith(".js") && files.has(url));
              if (!keep || seen.has(url)) return false;
              seen.add(url);
              entry.url = url;
              return true;
            });
            if (manifest.length >= 150) throw new Error(`Precache exceeds Item 10 budget: ${manifest.length} entries`);
            for (const required of ["offline.html", "manifest.webmanifest"]) {
              if (!seen.has(required)) throw new Error(`Required precache file missing: ${required}`);
            }
            console.info(`Item 10 precache: ${manifest.length} entries; no client/ URL prefixes`);
            return { manifest, warnings: [] };
          }],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          globPatterns: ["**/*.{js,css,woff2,png,svg,ico,webmanifest}", "**/offline.html"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === "navigate" && !/^\/(~oauth|api\/|auth|app-|reset-password|admin)/.test(url.pathname) && !url.searchParams.has("code") && !url.searchParams.has("token_hash"),
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 30 },
                precacheFallback: { fallbackURL: "/offline.html" },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: { cacheName: "assets", expiration: { maxEntries: 200 } },
            },
          ],
        },
      }),
    ],
  },
});
