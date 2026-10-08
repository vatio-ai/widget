import { camelize, themeFrom } from "./lib/config";
import { start } from "./start";

// The classic-script bootstrap behind cdn.vatio.ai/v1/widget.js: reads the
// host page's <script data-*> tag and hands it to start(), which is shared
// with the npm package (index.ts). Captured synchronously, at the top of the
// module, before any await -- document.currentScript becomes null once
// execution yields to a microtask, so this must not be deferred even by one
// `.then()`.
const script = document.currentScript as HTMLScriptElement | null;

// Baked in at build time for the CDN build, whose file does not ship from the
// API host (see frontend/README.md). Unset, the widget talks to wherever this
// script was loaded from.
const API_BASE_URL: string | null = import.meta.env.VITE_VATIO_API_URL || null;

if (script) boot(script);

function boot(script: HTMLScriptElement) {
  const workspace = script.getAttribute("data-workspace");
  const token = script.getAttribute("data-token");

  let origin: string;
  try {
    origin = new URL(script.src).origin;
  } catch {
    return;
  }

  // A tag with neither attribute filled in is a widget that has been placed
  // but not configured yet -- silence, not a console error, so an
  // unfinished install costs a host page nothing. One without the other is
  // a mistake worth naming.
  if (!workspace && !token) return;
  if (!workspace || !token) {
    console.error("[vatio-widget] needs both data-workspace and data-token (a vatpub_ publishable token)");
    return;
  }

  const options = window.VatioWidget && typeof window.VatioWidget === "object" ? window.VatioWidget : {};

  // The attribute is the source of truth; window.VatioWidget is the
  // fallback for values that only exist at runtime.
  function attr(name: string): string | null {
    const value = script.getAttribute("data-" + name);
    if (value != null && value !== "") return value;
    for (const key of [name, camelize(name)]) {
      const runtimeValue = options[key];
      if (runtimeValue != null && runtimeValue !== "") return String(runtimeValue);
    }
    return null;
  }

  function pick(name: string, runtimeValue: unknown, fallback: unknown): unknown {
    const fromAttr = script.getAttribute("data-" + name);
    if (fromAttr) return fromAttr;
    if (runtimeValue) return runtimeValue;
    return fallback;
  }

  // Inline mode, console-internal and not part of the documented embed: the
  // console's Test page shows the chat inside a card of its own.
  //   data-mode="inline"            the panel is always open, fills the
  //                                 container, and has no bubble, no close
  //                                 button and no Escape-to-close
  //   data-container="<selector>"   the element it fills (required)
  //   data-subtitle="<text>"        a line under the agent's name
  // Read off the tag only, never window.VatioWidget, so no existing install
  // can switch into it by accident.
  const inline = script.getAttribute("data-mode") === "inline";
  const containerSelector = script.getAttribute("data-container");

  const widget = start({
    workspace,
    token,
    baseUrl: API_BASE_URL || origin,
    visitorToken: attr("visitor-token"),
    theme: themeFrom(pick, (options.theme as Record<string, unknown>) || {}),
    position: attr("position"),
    scheme: attr("scheme"),
    replyStyle: attr("reply-style"),
    title: attr("title"),
    about: attr("about"),
    greeting: attr("greeting"),
    locale: attr("locale"),
    suggestions: attr("suggestions"),
    sessionScope: attr("session-scope"),
    eager: attr("eager") === "true",
    inline: inline
      ? {
          container: () => {
            try {
              return containerSelector ? document.querySelector(containerSelector) : null;
            } catch {
              return null;
            }
          },
          subtitle: script.getAttribute("data-subtitle") || null,
          // The console removes the tag when Turbo leaves the page.
          stillWanted: () => script.isConnected
        }
      : undefined
  });

  // The methods the widget exposes, hung on the object a host page already
  // uses to configure it. Assigning window.VatioWidget *after* the script tag
  // replaces this object and loses them, which is why the config half always
  // has to come first.
  window.VatioWidget = options;
  options.identify = widget.identify;
  // How the console takes an inline widget away again (Turbo navigation)
  // with its connection closed, not just its element removed.
  if (inline) options.unmount = widget.unmount;
}
