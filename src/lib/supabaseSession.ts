// The Supabase session the host page already has, read where supabase-js
// keeps it: localStorage for a browser client, cookies (possibly base64 and
// chunked) for @supabase/ssr. Only the access token leaves this file -- never
// the refresh token, which would let Vatio sign in as the person rather than
// only check who they are.

export interface SupabaseSession {
  accessToken: string;
  expiresAt: number | null;
}

const SIGN_IN_PARAM = "vatio_sign_in";
const SIGN_IN_STASH = "vatio:sign-in";
// A sign-in code works once, for ten minutes (SignInLink::TTL).
const SIGN_IN_TTL_MS = 10 * 60 * 1000;
const POLL_MS = 2000;

// The key supabase-js derives from the project URL unless the app passes its
// own storageKey.
export function storageKey(projectUrl: string): string | null {
  try {
    return `sb-${new URL(projectUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

export function readSession(key: string): SupabaseSession | null {
  return parse(fromLocalStorage(key)) || parse(fromCookies(key));
}

// The token to put on the widget, or null when signed out. An expired one is
// left alone: supabase-js is about to replace it, and a token the server
// would reject is no better than none.
export function currentToken(key: string): string | null {
  const session = readSession(key);
  return session && fresh(session) ? session.accessToken : null;
}

// Calls onChange whenever the page signs in, out, or refreshes its token.
// Polling is the only signal for the same tab -- a `storage` event fires only
// in the others -- and a localStorage read every two seconds costs nothing.
export function watchSession(key: string, initial: string | null, onChange: (token: string | null) => void): () => void {
  let last = initial;
  const check = () => {
    const session = readSession(key);
    if (session && !fresh(session)) return;

    const next = session ? session.accessToken : null;
    if (next === last) return;
    last = next;
    onChange(next);
  };

  const timer = window.setInterval(check, POLL_MS);
  window.addEventListener("storage", check);
  window.addEventListener("focus", check);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("storage", check);
    window.removeEventListener("focus", check);
  };
}

// The WhatsApp and Instagram sign-in button opens the workspace's own site
// with ?vatio_sign_in=<code>. Taken off the URL straight away, before an app
// router redirects a signed-in visitor somewhere else and drops it, and kept
// for the tab until there is a session to hand over.
export function captureSignInCode(): void {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get(SIGN_IN_PARAM);
    if (!code) return;

    window.sessionStorage.setItem(SIGN_IN_STASH, JSON.stringify({ code, at: Date.now() }));
    url.searchParams.delete(SIGN_IN_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // No sessionStorage (a sandboxed frame): the button simply does nothing here.
  }
}

// Once the visitor is signed in -- already, or after the site's own login
// page -- sends them to Vatio with the code and their access token. Vatio
// verifies it, asks them to confirm the number or handle unless the token's
// phone already matches, and returns them to the chat.
export function finishSignIn(apiBaseUrl: string, key: string): void {
  const code = pendingCode();
  if (!code) return;

  const attempt = () => {
    if (!pendingCode()) return window.clearInterval(timer);

    const token = currentToken(key);
    if (!token) return;

    window.clearInterval(timer);
    clearCode();
    window.location.assign(`${apiBaseUrl}/connect/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`);
  };
  const timer = window.setInterval(attempt, 1000);
  attempt();
}

function pendingCode(): string | null {
  try {
    const stashed = JSON.parse(window.sessionStorage.getItem(SIGN_IN_STASH) || "null");
    if (!stashed || typeof stashed.code !== "string") return null;
    if (Date.now() - Number(stashed.at) > SIGN_IN_TTL_MS) {
      clearCode();
      return null;
    }
    return stashed.code;
  } catch {
    return null;
  }
}

function clearCode() {
  try {
    window.sessionStorage.removeItem(SIGN_IN_STASH);
  } catch {
    // Nothing stashed that could be read either.
  }
}

function fresh(session: SupabaseSession): boolean {
  return session.expiresAt == null || session.expiresAt * 1000 > Date.now() + 10_000;
}

function parse(raw: string | null): SupabaseSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    // supabase-js v1 nested the session under currentSession.
    const session = value && (value.access_token ? value : value.currentSession);
    if (!session || typeof session.access_token !== "string") return null;

    return {
      accessToken: session.access_token,
      expiresAt: typeof session.expires_at === "number" ? session.expires_at : null
    };
  } catch {
    return null;
  }
}

function fromLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function fromCookies(key: string): string | null {
  const jar = new Map<string, string>();
  for (const part of document.cookie.split(";")) {
    const index = part.indexOf("=");
    if (index > 0) jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }

  let value = jar.get(key) ?? null;
  if (value == null) {
    const chunks: string[] = [];
    for (let index = 0; jar.has(`${key}.${index}`); index++) chunks.push(jar.get(`${key}.${index}`)!);
    value = chunks.length ? chunks.join("") : null;
  }
  if (value == null) return null;

  try {
    value = decodeURIComponent(value);
  } catch {
    // Not percent-encoded.
  }
  return value.startsWith("base64-") ? fromBase64Url(value.slice("base64-".length)) : value;
}

function fromBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}
