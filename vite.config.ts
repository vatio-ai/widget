import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { buildStamp } from "./build-stamp";

// The script-tag build: src/embed.tsx -- the classic-script bootstrap that
// reads the host page's <script data-*> tag -- bundled into one
// dependency-free IIFE, widget.js. CSS is pulled in with `?inline` and
// injected into the widget's own shadow root, so no .css asset is emitted.
// The npm package is the other build, vite.lib.config.ts.
//
// Preact, not React: this ships on every page that embeds the widget, so its
// weight is everyone's weight. @preact/preset-vite aliases react/react-dom
// to preact/compat, so src/**/*.tsx keeps importing from "react" unchanged.
//
// Where it lands:
//   VATIO_BUILD_TARGET=cdn  frontend/dist/v1, the tree frontend-deploy.yml
//                           hands to Cloudflare Pages as cdn.vatio.ai/v1/
//   inside the monorepo     backend/public/v1, for the Rails app in development
//   anywhere else           dist/script (the public vatio-ai/widget repo)
const cdn = process.env.VATIO_BUILD_TARGET === "cdn";
const inMonorepo = existsSync(fileURLToPath(new URL("../../backend/public", import.meta.url)));
const outDir = cdn ? "../dist/v1" : inMonorepo ? "../../backend/public/v1" : "dist/script";

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir,
    emptyOutDir: false,
    rollupOptions: { output: { banner: buildStamp() } },
    lib: {
      entry: "src/embed.tsx",
      formats: ["iife"],
      name: "__VatioWidget",
      fileName: () => "widget.js",
    },
  },
});
