import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { buildStamp } from "./build-stamp";

// The npm build, @vatio-ai/widget: src/index.ts as one ES module in dist/.
// Preact is bundled in -- the widget renders into its own shadow root and
// must not care which framework the host app uses. @vatio-ai/sdk is left as
// a dependency, installed next to it, rather than copied into this bundle.
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: ["@vatio-ai/sdk"],
      output: { banner: buildStamp() },
    },
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
});
