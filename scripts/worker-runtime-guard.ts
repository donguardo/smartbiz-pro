/** Build-time only: Workers do not provide import.meta.url for generated chunks. */
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