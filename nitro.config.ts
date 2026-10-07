import { defineConfig } from "nitro/config";

/** Keep this build-time guard inline so deployment needs no local helper import. */
export function guardWorkerRequire(code: string): string {
  const bindings = new Set<string>(["createRequire"]);
  // Minification can rename createRequire before Nitro's literal-string guard runs.
  for (const match of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](?:node:)?module["']/g)) {
    for (const specifier of (match[1] ?? "").split(",")) {
      const binding = specifier.trim().match(/^createRequire(?:\s+as\s+([\w$]+))?$/);
      if (binding) bindings.add(binding[1] ?? "createRequire");
    }
  }
  for (const binding of bindings) {
    const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    code = code.replace(
      new RegExp(`(?<![\\w$.])${escaped}\\(\\s*import\\.meta\\.url\\s*\\)`, "g"),
      `${binding}(import.meta.url || "file:///")`,
    );
  }
  return code;
}

export default defineConfig({
  rollupConfig: {
    plugins: [
      {
        name: "mvp-worker-runtime-guard",
        generateBundle: {
          order: "post",
          handler(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
              if (chunk.type === "chunk") chunk.code = guardWorkerRequire(chunk.code);
            }
          },
        },
      },
    ],
  },
});