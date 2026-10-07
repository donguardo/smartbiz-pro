import { defineConfig } from "nitro/config";
import { guardWorkerRequire } from "./build/worker-runtime-guard";

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