import { Vatio } from "@vatio-ai/sdk";

import type { AppConfig } from "./App";
import { copyFor } from "./lib/copy";
import { prefer, replyStyleFrom, schemeFrom, suggestionsFrom, themeWith, type PageTheme } from "./lib/config";
import { mountShadowWidget } from "./shadowMount";
import type { RemoteConfig, VatioSdk } from "./lib/sdk";
import { captureSignInCode, currentToken, finishSignIn, storageKey, watchSession } from "./lib/supabaseSession";

// Bundled, not fetched. This used to be a dynamic `import()` of a sibling
// /v1/sdk.js on the CDN, so the two files could be versioned and cached
// together. That bought one shared copy and cost a class of failure nobody
// could read: an import() is a *module* fetch, so it is a CORS request from
// every page that is not vatio.ai, and when it failed all the browser said
// was "Failed to fetch dynamically imported module" -- which reads like a 404
// and never was one. It reached production once.
const sdk = Vatio as unknown as VatioSdk;

// Everything the widget is configured with, whichever way it was installed:
// embed.tsx fills it from a <script data-*> tag, index.ts from the object a
// bundled app passes. Unset is null, so the workspace's own value (vatio.yml,
// fetched from /config) can still fill it -- the page wins, then the
// workspace, then the built-in default.
export interface StartOptions {
  workspace: string;
  token: string;
  baseUrl: string;
  visitorToken: string | null;
  theme: PageTheme;
  position: string | null;
  scheme: string | null;
  replyStyle: string | null;
  title: string | null;
  about: string | null;
  greeting: string | null;
  locale: string | null;
  suggestions: string | string[] | null;
  sessionScope: string | null;
  eager: boolean;
  // The console's Test page: always open, filling an element of its own.
  inline?: { container: () => Element | null; subtitle: string | null; stillWanted: () => boolean };
}

export interface StartedWidget {
  identify(visitorToken: string | null | undefined): void;
  unmount(): void;
}

export function start(options: StartOptions): StartedWidget {
  let visitorToken = options.visitorToken;
  // A page that says who is signed in is trusted over the Supabase session
  // the widget would otherwise read.
  let pageIdentifies = visitorToken != null;
  // Until <App> is rendered, identify() only records who is signed in;
  // initialVisitorToken is read from `visitorToken` when it does render.
  let liveIdentify: ((token: string | null) => void) | null = null;
  let mounted: { unmount(): void } | null = null;
  let stopWatching: (() => void) | null = null;
  let stopped = false;

  captureSignInCode();

  // Nothing renders until we know there is an agent to talk to: a bubble
  // that opens onto an error is worse than no bubble.
  whenIdle(options.eager, () => {
    if (stopped) return;
    sdk
      .config({ workspace: options.workspace, token: options.token, baseUrl: options.baseUrl })
      .then(mount)
      .catch(reportSetupProblem);
  });

  function mount(remote: RemoteConfig) {
    if (stopped) return;
    if (document.getElementById("vatio-widget-host")) return; // one per page

    let container: Element = document.body;
    if (options.inline) {
      // The page that asked for it has moved on while /config was answering.
      if (!options.inline.stillWanted()) return;
      const target = options.inline.container();
      if (!target) {
        console.error('[vatio-widget] data-mode="inline" needs data-container to match an element on the page');
        return;
      }
      container = target;
    }

    const ui = remote.ui || {};
    const theme = themeWith(options.theme, remote.theme);
    const position = prefer(options.position, ui.position) === "left" ? "left" : "right";
    const scheme = schemeFrom(prefer(options.scheme, ui.scheme) || "auto");
    const replyStyle = replyStyleFrom(prefer(options.replyStyle, ui.reply_style));
    const greeting = prefer(options.greeting, ui.greeting);
    const suggestions = suggestionsFrom(options.suggestions != null ? options.suggestions : (ui.suggestions || null));

    const supabaseKey = remote.auth?.supabase ? storageKey(remote.auth.supabase) : null;
    if (supabaseKey) {
      finishSignIn(options.baseUrl, supabaseKey);
      if (!pageIdentifies) visitorToken = currentToken(supabaseKey);
    }

    const config: AppConfig = {
      workspace: options.workspace,
      token: options.token,
      baseUrl: options.baseUrl,
      sessionScope: options.sessionScope,
      inline: Boolean(options.inline),
      subtitle: options.inline?.subtitle ?? null,
      initialVisitorToken: visitorToken,
      title: prefer(options.title, ui.title),
      about: options.about,
      greeting,
      locale: options.locale,
      suggestions,
      replyStyle
    };

    const copy = copyFor(config.locale, remote.locale);

    mounted = mountShadowWidget({
      container,
      theme,
      remoteAccent: remote.theme.accent,
      scheme,
      position,
      mode: options.inline ? "inline" : undefined,
      lang: copy.lang,
      app: {
        vatio: sdk,
        config,
        remote,
        onReady: (api) => {
          liveIdentify = api.identify;
          if (!supabaseKey || pageIdentifies) return;

          stopWatching = watchSession(supabaseKey, visitorToken, (next) => {
            if (pageIdentifies) return stopWatching?.();
            visitorToken = next;
            api.identify(next);
          });
        }
      }
    });
  }

  return {
    identify(value) {
      pageIdentifies = true;
      const next = value == null || value === "" ? null : String(value);
      if (next === visitorToken) return;
      visitorToken = next;
      liveIdentify?.(next);
    },
    // Closes the connection and removes the widget, and stops a mount that
    // is still waiting on /config from happening at all.
    unmount() {
      stopped = true;
      stopWatching?.();
      stopWatching = null;
      mounted?.unmount();
      mounted = null;
      liveIdentify = null;
    }
  };
}

function whenIdle(eager: boolean, run: () => void) {
  if (eager) return run();

  const afterLoad = () => {
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 500);
  };

  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });
}

function reportSetupProblem(error: { code?: string; message?: string } | undefined) {
  // origin_not_allowed and no_agent_deployed are both installer mistakes with
  // an exact fix, and the SDK already writes the first to the console.
  if (error && error.code === "no_agent_deployed") console.warn("[vatio-widget] " + error.message);
  else if (error && error.code !== "origin_not_allowed") console.warn("[vatio-widget] " + (error.message || error));
}
