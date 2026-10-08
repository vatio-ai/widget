import { createRoot } from "react-dom/client";
import { App, type AppProps } from "./App";
import { readableInk, liftForDark } from "./lib/color";
import { SYSTEM_FONT, tokensFor, type ThemeConfig } from "./lib/config";
import styles from "./styles.css?inline";

// `data-font="inherit"` is documented as "use the host page's font", but the
// widget's :host sets `all: initial` to keep the page's own CSS out -- which
// also cuts inheritance at the shadow boundary, so a literal `inherit` had
// nothing left to inherit from and every panel fell back to the browser's
// serif default. Resolve it here instead, once, against the element the
// widget is mounted into: the page's stack, copied in rather than inherited.
function inheritedFont(font: string, container: Element): string {
  if (String(font).trim().toLowerCase() !== "inherit") return font;
  try {
    return getComputedStyle(container).fontFamily || SYSTEM_FONT;
  } catch {
    return SYSTEM_FONT;
  }
}

// Shared by embed.tsx (the production bootstrap, parsed from a <script
// data-*> tag) and dev-main.tsx (fixed dev config): creates the shadow-root
// host, sets the theme as CSS custom properties per styles.css's contract
// (light/dark pairs -- see that file's header comment), and renders <App>
// into it. One mounting path, so dev and prod can never drift apart
// visually.
export function mountShadowWidget(options: {
  container: Element;
  theme: ThemeConfig;
  remoteAccent: string | null;
  scheme: "auto" | "light" | "dark";
  position: "left" | "right";
  // "inline" fills `container` instead of floating over the page (see
  // embed.tsx); left out, the widget is the bubble.
  mode?: "inline";
  lang: string;
  app: AppProps;
}) {
  const { container, theme, remoteAccent, scheme, position, mode, lang, app } = options;

  const host = document.createElement("div");
  host.id = "vatio-widget-host";
  container.appendChild(host);

  const accent = theme.accent || remoteAccent || "#111827";
  const accentInk = theme.accentInk || readableInk(accent);
  const darkAccent = liftForDark(accent);
  const darkAccentInk = theme.accentInk || readableInk(darkAccent);
  const light = tokensFor("light", theme);
  const dark = tokensFor("dark", theme);

  host.lang = lang;
  host.setAttribute("data-scheme", scheme);
  host.setAttribute("data-position", position);
  if (mode) host.setAttribute("data-mode", mode);
  host.style.setProperty("--vw-accent-light", accent);
  host.style.setProperty("--vw-accent-ink-light", accentInk);
  host.style.setProperty("--vw-surface-light", light.surface);
  host.style.setProperty("--vw-ink-light", light.ink);
  host.style.setProperty("--vw-muted-light", light.muted);
  host.style.setProperty("--vw-line-light", light.line);
  host.style.setProperty("--vw-accent-dark", darkAccent);
  host.style.setProperty("--vw-accent-ink-dark", darkAccentInk);
  host.style.setProperty("--vw-surface-dark", dark.surface);
  host.style.setProperty("--vw-ink-dark", dark.ink);
  host.style.setProperty("--vw-muted-dark", dark.muted);
  host.style.setProperty("--vw-line-dark", dark.line);
  host.style.setProperty("--vw-radius", theme.radius);
  host.style.setProperty("--vw-font", inheritedFont(theme.font, container));

  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  mountPoint.id = "root";
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<App {...app} />);
  return {
    host,
    // Unmounting, not just removing the host, is what runs the chat hook's
    // cleanup and closes its connection.
    unmount() {
      root.unmount();
      host.remove();
    }
  };
}
