// Pure config-parsing logic ported from public/vatio-widget.js, split out of
// the DOM-specific bootstrap so it can be unit-exercised and reused by
// dev-main.tsx. `readAttr` is the one DOM dependency, injected by the caller
// (embed.tsx reads `script.getAttribute`; dev-main.tsx can pass a no-op).
// The theme after every source has had its say — what the CSS variables are
// set from, so `radius` and `font` are always a value.
export interface ThemeConfig {
  accent: string | null;
  accentInk: string | null;
  surface: string | null;
  ink: string | null;
  muted: string | null;
  line: string | null;
  radius: string;
  font: string;
}

// What the host page alone said. Every field may be null here, including the
// two that end up with built-in defaults: "the page did not say" has to
// survive as far as themeWith, or the workspace's value can never be reached.
export type PageTheme = Omit<ThemeConfig, "radius" | "font"> & {
  radius: string | null;
  font: string | null;
};


export const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const PALETTE = {
  light: { surface: "#ffffff", ink: "#111827", muted: "#6b7280", line: "#e5e7eb" },
  dark: { surface: "#1c1c1f", ink: "#ececef", muted: "#9a9aa4", line: "#33333a" }
} as const;

export function tokensFor(scheme: "light" | "dark", theme: ThemeConfig) {
  const base = PALETTE[scheme];
  return {
    surface: theme.surface || base.surface,
    ink: theme.ink || base.ink,
    muted: theme.muted || base.muted,
    line: theme.line || base.line
  };
}

// A hyphenated attribute reads as camelCase in the runtime-options object
// (`data-visitor-token` / `visitorToken`), because that is how the property
// would have been named if it had only ever been JavaScript.
export function camelize(name: string): string {
  return String(name).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

// Only the panel's own greys follow the OS; the accent is the workspace's
// brand either way. "light" is how the widget behaved before schemes
// existed.
export function schemeFrom(value: unknown): "auto" | "light" | "dark" {
  const name = String(value || "").trim().toLowerCase();
  return name === "light" || name === "dark" ? name : "auto";
}

// "paced" is what the workspace's WhatsApp and Instagram get: short bubbles,
// each after a typing indicator. Anything else is the web's default.
export function replyStyleFrom(value: unknown): "stream" | "paced" {
  return String(value || "").trim().toLowerCase() === "paced" ? "paced" : "stream";
}

// Four is the most that fits above the composer without the empty state
// turning into a menu, and a menu is not what an open-ended chat is for.
export function suggestionsFrom(value: unknown): string[] {
  const list = Array.isArray(value) ? value : String(value == null ? "" : value).split("|");
  return list
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

// null means "the host page didn't say", which is different from a value:
// the greys have one default per scheme, and only an unset token is allowed
// to change when the visitor's OS is dark.
//
// `radius` and `font` are read with a null fallback rather than their built-in
// defaults, so that "unset" survives long enough for the workspace's own value
// to be offered. `themeWith` puts the defaults back.
export function themeFrom(
  pick: (name: string, runtimeValue: unknown, fallback: unknown) => unknown,
  runtime: Record<string, unknown>
): PageTheme {
  return {
    accent: pick("accent", runtime.accent, null) as string | null,
    accentInk: pick("accent-ink", runtime.accentInk, null) as string | null,
    surface: pick("surface", runtime.surface, null) as string | null,
    ink: pick("ink", runtime.ink, null) as string | null,
    muted: pick("muted", runtime.muted, null) as string | null,
    line: pick("line", runtime.line, null) as string | null,
    radius: pick("radius", runtime.radius, null) as string | null,
    font: pick("font", runtime.font, null) as string | null
  };
}

// The precedence the docs describe, in one place: the host page wins, then the
// workspace's `vatio.yml`, then the built-in default. Written as a function
// because there are eleven fields and eleven hand-written `??` chains is where
// one of them silently gets the order backwards.
//
// An empty string counts as unset. `data-greeting=""` is how a page ends up
// asking for the default rather than for a blank greeting, and the attribute
// reader already treats it that way.
export function prefer<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value != null && value !== ("" as unknown as T)) return value;
  }
  return null;
}

// The workspace's half of the theme, in the wire's snake_case. Declared here
// rather than imported from sdk.ts so this module stays free of the SDK.
export interface RemoteThemeTokens {
  accent?: string | null;
  accent_ink?: string | null;
  surface?: string | null;
  ink?: string | null;
  muted?: string | null;
  line?: string | null;
  radius?: string | null;
  font?: string | null;
}

// The theme as the CSS finally sees it: page over workspace over default.
export function themeWith(page: PageTheme, remote: RemoteThemeTokens): ThemeConfig {
  return {
    accent: prefer(page.accent, remote.accent),
    accentInk: prefer(page.accentInk, remote.accent_ink),
    surface: prefer(page.surface, remote.surface),
    ink: prefer(page.ink, remote.ink),
    muted: prefer(page.muted, remote.muted),
    line: prefer(page.line, remote.line),
    radius: prefer(page.radius, remote.radius, "16px") as string,
    font: prefer(page.font, remote.font, SYSTEM_FONT) as string
  };
}
