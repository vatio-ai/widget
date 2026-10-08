/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VATIO_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css?inline" {
  const css: string;
  export default css;
}

interface Window {
  VatioWidget?: Record<string, unknown> & { identify?: (token: string | null | undefined) => void };
  Vatio?: import("./lib/sdk").VatioSdk;
}
