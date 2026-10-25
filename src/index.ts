import { themeFrom } from "./lib/config";
import { start } from "./start";

// @vatio-ai/widget -- the Vatio chat widget for apps with a bundler. The same
// widget as <script src="https://cdn.vatio.ai/v1/widget.js">, mounted from code.

export interface VatioWidgetTheme {
  accent?: string;
  accentInk?: string;
  surface?: string;
  ink?: string;
  muted?: string;
  line?: string;
  radius?: string;
  font?: string;
}

export interface VatioWidgetOptions {
  /** Your workspace slug. */
  workspace: string;
  /** A publishable token (`vatpub_…`), allowed for this page's origin. */
  token: string;
  /** Where the Vatio API answers. Defaults to https://vatio.ai. */
  baseUrl?: string;
  /** The signed-in visitor's JWT. Change it later with identify(). */
  visitorToken?: string | null;
  position?: "left" | "right";
  scheme?: "auto" | "light" | "dark";
  replyStyle?: "stream" | "paced";
  title?: string;
  about?: string;
  greeting?: string;
  locale?: string;
  suggestions?: string[];
  /** Keeps separate conversations for the same browser, e.g. one per signed-in account. */
  sessionScope?: string;
  /** Mount as soon as /config answers instead of waiting for the page to go idle. */
  eager?: boolean;
  theme?: VatioWidgetTheme;
}

export interface VatioWidget {
  /** Who is signed in now: a JWT, or null to sign out. The conversation carries over. */
  identify(visitorToken: string | null): void;
  /** Closes the connection and removes the widget from the page. */
  unmount(): void;
}

const DEFAULT_BASE_URL = "https://vatio.ai";

/**
 * Mounts the Vatio chat widget on the page. One per page: a second call while
 * one is mounted does nothing until the first is unmounted.
 */
export function mountVatioWidget(options: VatioWidgetOptions): VatioWidget {
  if (!options || !options.workspace || !options.token) {
    throw new Error("mountVatioWidget needs `workspace` and `token` (a vatpub_ publishable token)");
  }
  if (typeof document === "undefined") {
    throw new Error("mountVatioWidget runs in the browser; call it after your app has mounted");
  }

  const theme = options.theme || {};
  const widget = start({
    workspace: options.workspace,
    token: options.token,
    baseUrl: (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    visitorToken: options.visitorToken ?? null,
    theme: themeFrom((_name, value) => value ?? null, theme as Record<string, unknown>),
    position: options.position ?? null,
    scheme: options.scheme ?? null,
    replyStyle: options.replyStyle ?? null,
    title: options.title ?? null,
    about: options.about ?? null,
    greeting: options.greeting ?? null,
    locale: options.locale ?? null,
    suggestions: options.suggestions ?? null,
    sessionScope: options.sessionScope ?? null,
    eager: Boolean(options.eager)
  });

  return { identify: widget.identify, unmount: widget.unmount };
}
