import { useEffect, useRef, useState } from "react";
import { Bubble } from "./components/Bubble";
import { Header } from "./components/Header";
import { ThreadList } from "./components/ThreadList";
import { Conversation } from "./components/Conversation";
import { copyFor } from "./lib/copy";
import { useVatioChat } from "./hooks/useVatioChat";
import type { RemoteConfig, ReplyStyle, VatioSdk } from "./lib/sdk";

export interface AppConfig {
  workspace: string;
  token: string;
  baseUrl: string;
  sessionScope: string | null;
  // data-mode="inline" (see embed.tsx): the panel is part of the host page,
  // permanently open, with no bubble and nothing to close.
  inline: boolean;
  // A second line under the agent's name in the header. Inline mode only.
  subtitle: string | null;
  initialVisitorToken: string | null;
  title: string | null;
  about: string | null;
  greeting: string | null;
  locale: string | null;
  suggestions: string[];
  // How replies arrive: one answer written out as it comes, or the short
  // bubbles with a typing indicator that WhatsApp and Instagram get.
  replyStyle: ReplyStyle;
}

export interface AppProps {
  vatio: VatioSdk;
  config: AppConfig;
  remote: RemoteConfig;
  onReady?: (api: { identify: (token: string | null | undefined) => void }) => void;
}

// Ported from mount(Vatio, remote) in public/vatio-widget.js. Rendered
// inside the widget's own shadow root (embed.tsx) or straight into #root
// for dev iteration (dev-main.tsx) -- this component doesn't know which.
export function App({ vatio, config, remote, onReady }: AppProps) {
  const copy = copyFor(config.locale, remote.locale);
  const name = config.title || remote.agent?.name || copy.name;
  const avatarUrl = remote.agent?.avatar_url || null;
  // The host page's data-about wins over vatio.yml's widget.about, the same
  // way data-title wins over the agent's name.
  const about = config.about || remote.agent?.about || null;
  const greeting = config.greeting || copy.greeting;

  const inline = config.inline;
  const [open, setOpen] = useState(inline);
  // Bumped whenever the original called input.focus() imperatively --
  // toggle() onto an existing chat, restart(), openConversation(). Composer
  // watches it and calls focus() itself, since it owns the textarea ref.
  const [focusSignal, setFocusSignal] = useState(0);
  const requestFocus = () => setFocusSignal((n) => n + 1);

  const chat = useVatioChat({
    vatio,
    workspace: config.workspace,
    token: config.token,
    baseUrl: config.baseUrl,
    sessionScope: config.sessionScope,
    initialVisitorToken: config.initialVisitorToken,
    replyStyle: config.replyStyle,
    copy,
    onChatEvent: (detail) => window.dispatchEvent(new CustomEvent("vatio:chat", { detail }))
  });

  // syncBack(): the panel now always opens onto the list first, so a
  // conversation on screen always has somewhere to go back to.
  const backOn = true;

  const readyRef = useRef(false);
  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady?.({ identify: chat.identify });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inline mode has nothing to open, so it lands where an open panel shows
  // what it is for -- the conversation, with the composer -- resuming the
  // last one if there is one. The list is a back arrow away.
  useEffect(() => {
    if (!inline || !chat.resumable()) return;
    void chat.refreshThreads();
    void chat.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A link into the host site reloads the page the widget sits on (see
  // anchor() in lib/markdown.ts). The visitor clicked it from inside the
  // conversation, so the next page opens back onto it instead of a closed
  // bubble. Stamped with the time, so a click a router swallowed without
  // reloading cannot pop the panel open on some unrelated load later.
  const reopenKey = "vatio:reopen:" + config.workspace;
  function rememberOpen(event: { target: EventTarget | null }) {
    const link = (event.target as Element).closest?.("a[href]");
    if (inline || !link || link.hasAttribute("target")) return;
    try {
      sessionStorage.setItem(reopenKey, String(Date.now()));
    } catch {}
  }
  useEffect(() => {
    if (inline) return;
    let stamp = 0;
    try {
      stamp = Number(sessionStorage.getItem(reopenKey));
      sessionStorage.removeItem(reopenKey);
    } catch {}
    if (!stamp || Date.now() - stamp > 30_000) return;
    setOpen(true);
    void chat.refreshThreads();
    void chat.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showThreads() {
    chat.setBrowsing(true);
    void chat.refreshThreads();
  }
  function showConversation() {
    chat.setBrowsing(false);
  }

  function toggle() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        // The first open lands on the list of past conversations, not a
        // live one. Once something is on screen, reopening the panel just
        // shows it again.
        if (chat.connected || chat.starting) requestFocus();
        else showThreads();
      }
      return next;
    });
  }

  // One step back per Escape press: out of the list first, out of the
  // panel only once there is nothing left to back out of. Not inline: the
  // host page owns Escape there.
  useEffect(() => {
    if (inline) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!open || event.key !== "Escape") return;
      if (chat.browsing) showConversation();
      else toggle();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat.browsing]);

  function restart() {
    chat.restart();
    showConversation();
    requestFocus();
  }

  const panelClassName = [open ? "open" : "", chat.browsing ? "browsing" : ""].filter(Boolean).join(" ");

  return (
    <>
      {inline ? null : <Bubble open={open} name={name} onClick={toggle} />}
      <div id="panel" role={inline ? "region" : "dialog"} aria-label={name} className={panelClassName} onClick={rememberOpen}>
        <Header
          name={name}
          avatarUrl={avatarUrl}
          copy={copy}
          subtitle={config.subtitle}
          backOn={backOn}
          onBack={showThreads}
          onClose={inline ? undefined : toggle}
        />
        <ThreadList
          name={name}
          avatarUrl={avatarUrl}
          about={about}
          conversations={chat.conversations}
          currentChatId={chat.chatId}
          copy={copy}
          onNew={restart}
          onOpen={(entry) => {
            showConversation();
            chat.openConversation(entry);
            requestFocus();
          }}
        />
        <div id="main">
          <Conversation
            workspace={config.workspace}
            turns={chat.turns}
            feedback={chat.feedback}
            onFeedback={chat.submitFeedback}
            typing={chat.typing}
            paced={config.replyStyle === "paced"}
            showIntro={chat.turns.length === 0}
            introName={name}
            introAvatarUrl={avatarUrl}
            greeting={greeting}
            suggestions={config.suggestions}
            status={chat.status}
            painting={chat.painting}
            copy={copy}
            onSuggestion={(text) => chat.submit(text)}
            onRetry={(turn) => chat.retry(turn.id, turn.mediaLabel ? "" : turn.text, turn.files)}
            onStop={chat.stopPainting}
            onSubmit={(text, files) => chat.submit(text, files)}
            focusSignal={focusSignal}
          />
        </div>
      </div>
    </>
  );
}
