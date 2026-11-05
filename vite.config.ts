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
//
// The SDK inside it is the one in this repo's sdk/src, not the one on npm, so
// every deploy ships the newest SDK with no release to wait for and no
// lockfile to bump: an SDK change reaches every page that embeds the widget
// on the same push to main that publishes it to npm. Outside the monorepo
// (the public vatio-ai/widget repo) there is no sdk/src, and the build takes
// @vatio-ai/sdk from npm like any other dependency.
const cdn = process.env.VATIO_BUILD_TARGET === "cdn";
const inMonorepo = existsSync(fileURLToPath(new URL("../../backend/public", import.meta.url)));
const outDir = cdn ? "../dist/v1" : inMonorepo ? "../../backend/public/v1" : "dist/script";
const sdkSource = fileURLToPath(new URL("../../sdk/src/index.ts", import.meta.url));

export default defineConfig({
  plugins: [preact()],
  resolve: existsSync(sdkSource) ? { alias: { "@vatio-ai/sdk": sdkSource } } : {},
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
