import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatSession, ChatStatus, ConversationEntry, ReplyStyle, SessionKey, VatioSdk } from "../lib/sdk";
import { kindOf } from "../lib/files";
import type { FeedbackRating, VisitorFeedback } from "../lib/feedback";
import type { Copy } from "../lib/copy";

export interface TurnAttachment {
  kind: "image" | "audio" | "video" | "file";
  filename: string;
  // A local object URL while the upload is pending, the stored file's after.
  url: string | null;
}

export interface Turn {
  id: number;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  failed?: boolean;
  streaming?: boolean;
  // The server's id, so a later `update` (a voice note's transcript) finds it.
  messageId?: number;
  attachments?: TurnAttachment[];
  // `text` is a stand-in ("Image", "Audio") the bubble should not print.
  mediaLabel?: boolean;
  // Kept for a retry of a message that failed to send.
  files?: File[];
}

function fromServer(attachments: ChatAttachment[] | undefined): TurnAttachment[] | undefined {
  if (!attachments || !attachments.length) return undefined;
  return attachments.map((attachment) => ({ kind: attachment.kind, filename: attachment.filename, url: attachment.url }));
}

// Codes the SDK and the server use for a file they will not take. None of
// them is worth a retry: the same file fails the same way.
const FILE_ERRORS: Record<string, keyof Pick<Copy, "fileTooLarge" | "tooManyFiles" | "fileUnsupported">> = {
  file_too_large: "fileTooLarge",
  too_many_files: "tooManyFiles",
  unsupported_file_type: "fileUnsupported"
};

export interface UseVatioChatArgs {
  vatio: VatioSdk;
  workspace: string;
  token: string;
  baseUrl: string;
  sessionScope: string | null;
  initialVisitorToken: string | null;
  replyStyle: ReplyStyle;
  copy: Copy;
  onChatEvent: (detail: { chatId: string | number; workspace: string; environment: string; settled: boolean }) => void;
}

let nextId = 1;

// The painter chases a target string rather than animating a fixed one --
// ported from openAssistant/feed/close/frame/settle in public/vatio-widget.js.
// Only one turn paints at a time: a new answer settles whatever came before
// it first (see start()/submit() calling through addAssistant equivalents).
function paintRate(behindChars: number): number {
  return Math.max(170, Math.min(900, behindChars / 0.4));
}

export function useVatioChat(args: UseVatioChatArgs) {
  const { vatio, workspace, token, baseUrl, sessionScope, replyStyle, copy, onChatEvent } = args;

  const [visitorToken, setVisitorToken] = useState(args.initialVisitorToken);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typing, setTyping] = useState(false);
  const [status, setStatusState] = useState<{ text: string; busy: boolean }>({ text: "", busy: false });
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [chatId, setChatId] = useState<string | number | null>(null);
  const [connected, setConnected] = useState(false);
  const [feedback, setFeedback] = useState<VisitorFeedback | null>(null);
  const [starting, setStarting] = useState(false);

  const chatRef = useRef<ChatSession | null>(null);
  const startingRef = useRef<Promise<ChatSession | void> | null>(null);
  const announcedRef = useRef(false);
  const paintRaf = useRef(0);
  const activePaint = useRef<{ turnId: number; target: string } | null>(null);

  // config.visitorToken can change under us (see identify()), so every call
  // that touches stored state reads it fresh via this ref rather than
  // closing over a stale value.
  const sessionKeyRef = useRef<SessionKey>({ workspace, baseUrl, scope: sessionScope, visitorToken });
  sessionKeyRef.current = { workspace, baseUrl, scope: sessionScope, visitorToken };

  const setStatus = useCallback((text: string, busy: boolean) => setStatusState({ text, busy }), []);

  const settlePainting = useCallback((turnId: number, finalText: string) => {
    cancelAnimationFrame(paintRaf.current);
    paintRaf.current = 0;
    activePaint.current = null;
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, text: finalText, streaming: false } : t)));
  }, []);

  // Also what the composer's Stop button does: finishes whatever is being
  // written at once, dropping the caret.
  const stopPainting = useCallback(() => {
    if (!activePaint.current) return;
    const { turnId, target } = activePaint.current;
    settlePainting(turnId, target);
  }, [settlePainting]);

  const paint = useCallback((turnId: number, target: string) => {
    activePaint.current = { turnId, target };
    let shown = 0;
    let last = 0;

    const frame = (now: number) => {
      if (!last) last = now;
      const elapsed = (now - last) / 1000;
      last = now;

      const behind = target.length - shown;
      const rate = paintRate(behind);
      shown = Math.min(target.length, shown + Math.max(1, Math.round(rate * elapsed)));
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, text: target.slice(0, shown) } : t)));

      if (shown < target.length) paintRaf.current = requestAnimationFrame(frame);
      else settlePainting(turnId, target);
    };

    paintRaf.current = requestAnimationFrame(frame);
  }, [settlePainting]);

  const addUser = useCallback((text: string, extra: Partial<Turn> = {}): number => {
    const id = nextId++;
    setTurns((prev) => [...prev, { id, role: "user", text, ...extra }]);
    return id;
  }, []);

  const addAssistant = useCallback((text: string, animate: boolean) => {
    const id = nextId++;
    const reducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const value = String(text == null ? "" : text);

    if (!animate || reducedMotion || value.length < 2) {
      setTurns((prev) => [...prev, { id, role: "assistant", text: value }]);
      return;
    }

    setTurns((prev) => [...prev, { id, role: "assistant", text: "", streaming: true }]);
    paint(id, value);
  }, [paint]);

  const detach = useCallback(() => {
    cancelAnimationFrame(paintRaf.current);
    paintRaf.current = 0;
    activePaint.current = null;
    if (chatRef.current) {
      try {
        chatRef.current.close();
      } catch {
        /* already gone */
      }
    }
    chatRef.current = null;
    startingRef.current = null;
    announcedRef.current = false;
    setFeedback(null);
    setChatId(null);
    setConnected(false);
    setStarting(false);
    setTurns([]);
    setTyping(false);
    setStatus("", false);
  }, [setStatus]);

  const refreshThreads = useCallback(() => {
    if (typeof vatio.conversations !== "function") return Promise.resolve();
    return vatio
      .conversations({ ...sessionKeyRef.current, token })
      .then((list) => setConversations(list))
      // A list that would not load is not worth a message over a
      // conversation that works: the way back just stays hidden.
      .catch(() => {});
  }, [vatio, token]);

  const start = useCallback((conversation?: ConversationEntry | null): Promise<ChatSession | void> => {
    if (chatRef.current || startingRef.current) return startingRef.current ?? Promise.resolve();

    setStatus(copy.connecting, true);
    setStarting(true);
    const promise = vatio
      .chat({
        workspace,
        token,
        baseUrl,
        scope: sessionScope,
        visitorToken: sessionKeyRef.current.visitorToken,
        conversation: conversation ?? null,
        replyStyle,
        widget: true
      })
      .then((session) => {
        chatRef.current = session;
        startingRef.current = null;
        setStarting(false);
        setChatId(session.chatId);
        setConnected(true);
        setStatus("", false);

        onChatEvent({ chatId: session.chatId, workspace, environment: session.environment, settled: false });

        session.on("message", (message) => {
          if (message.role === "user") return;
          // A paced bubble lands whole, the way a text does, and takes the
          // dots down with it: the server raises them again before the next
          // one, and lowers them for good after the last.
          if (replyStyle === "paced") {
            setTyping(false);
            addAssistant(message.content, false);
          } else addAssistant(message.content, true);
        });
        session.on("typing", (isTyping) => setTyping(isTyping));
        session.on("status", (state: ChatStatus) => {
          if (state === "reconnecting") setStatus(copy.reconnecting, true);
          else if (state === "connected") setStatus("", false);
        });
        session.on("error", (error) => setStatus(error && error.message ? error.message : copy.failed, false));

        // Pushed when Vatio offers it, and fetched by the SDK on connect for a
        // conversation that was resumed. Null once the moment has passed.
        session.on("feedback", (next) => {
          if (chatRef.current !== session) return;
          setFeedback(next?.dismissed ? null : next);
        });
        // A voice note arrives as "Audio" and its transcript a few seconds
        // later, for the message with that id.
        session.on("update", (update) => {
          if (chatRef.current !== session) return;
          setTurns((prev) => prev.map((t) => (t.messageId === update.id
            ? { ...t, text: update.content, mediaLabel: update.content_is_media_label }
            : t)));
        });
        void refreshThreads();

        return session.history().then((messages) => {
          if (!messages.length) return;
          // A resumed conversation replaces the empty state with what was
          // actually said, replayed at once -- nobody wants to watch
          // yesterday's answers being written out again.
          messages.forEach((message) => {
            if (message.role === "user") {
              addUser(message.content, {
                messageId: message.id,
                attachments: fromServer(message.attachments),
                mediaLabel: message.content_is_media_label
              });
            } else addAssistant(message.content, false);
          });
        });
      })
      .catch((error) => {
        startingRef.current = null;
        setStarting(false);
        setStatus(error && error.message ? error.message : copy.cannotStart, false);
      });

    startingRef.current = promise;
    return promise;
  }, [vatio, workspace, token, baseUrl, sessionScope, replyStyle, copy, addAssistant, addUser, onChatEvent, refreshThreads, setStatus]);

  const submit = useCallback((text: string, files: File[] = []) => {
    setFeedback((current) => current?.rating ? current : null);
    // Drawn from the files themselves until the server says where it kept
    // them, so a photo is on screen the moment it is sent.
    const local = files.map((file) => ({
      kind: kindOf(file),
      filename: file.name,
      url: kindOf(file) === "file" ? null : URL.createObjectURL(file)
    }));
    const turnId = addUser(text, {
      pending: true,
      attachments: local.length ? local : undefined,
      mediaLabel: !text.trim() && files.length > 0,
      files: files.length ? files : undefined
    });

    Promise.resolve(start())
      .then(() => {
        if (!chatRef.current) throw new Error("chat unavailable");
        return chatRef.current.send(text, files.length ? { files } : undefined);
      })
      .then((result) => {
        const stored = result && result.message;
        setTurns((prev) => prev.map((t) => {
          if (t.id !== turnId) return t;
          if (!stored) return { ...t, pending: false };
          local.forEach((attachment) => attachment.url && URL.revokeObjectURL(attachment.url));
          return {
            ...t,
            pending: false,
            files: undefined,
            messageId: stored.id,
            text: stored.content,
            attachments: fromServer(stored.attachments) || t.attachments,
            mediaLabel: stored.content_is_media_label
          };
        }));
        if (!announcedRef.current && chatRef.current) {
          announcedRef.current = true;
          onChatEvent({ chatId: chatRef.current.chatId, workspace, environment: chatRef.current.environment, settled: true });
          void refreshThreads();
        }
      })
      .catch((error) => {
        const fileError = FILE_ERRORS[(error && error.code) || ""];
        if (fileError) {
          // Refused, not lost: the same file would fail again, so there is
          // nothing to retry. Say why and take the bubble back.
          setTurns((prev) => prev.filter((t) => t.id !== turnId));
          setStatus(copy[fileError], false);
          return;
        }
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, pending: false, failed: true } : t)));
        setStatus(copy.retry, false);
      });
  }, [addUser, start, onChatEvent, workspace, refreshThreads, setStatus, copy]);

  const retry = useCallback((turnId: number, text: string, files: File[] = []) => {
    setTurns((prev) => prev.filter((t) => t.id !== turnId));
    setStatus("", false);
    submit(text, files);
  }, [submit, setStatus]);

  const restart = useCallback(() => {
    detach();
    vatio.reset(sessionKeyRef.current);
    setBrowsing(false);
    void start();
  }, [detach, vatio, start]);

  const openConversation = useCallback((entry: ConversationEntry) => {
    if (chatRef.current && String(chatRef.current.chatId) === String(entry.chatId)) {
      setBrowsing(false);
      return;
    }
    detach();
    setBrowsing(false);
    void start(entry);
  }, [detach, start]);

  // Signing in mid-conversation does not throw the conversation away. This
  // detaches and starts again, but `start()` reloads history from the server
  // and the SDK carries the anonymous chat over to the identity it just
  // gained — so what comes back is the same conversation, now with a name on
  // it. The one case that really does begin again is signing in as somebody
  // else, and there the server refuses to hand over the old chat.
  const identify = useCallback((visitorTokenValue: string | null | undefined) => {
    const next = visitorTokenValue == null || visitorTokenValue === "" ? null : String(visitorTokenValue);
    if (next === sessionKeyRef.current.visitorToken) return;

    const wasLive = Boolean(chatRef.current || startingRef.current);
    // Updated synchronously, not just via setState: start() (called
    // synchronously below when wasLive) must see `next` immediately rather
    // than waiting for a re-render.
    sessionKeyRef.current = { ...sessionKeyRef.current, visitorToken: next };
    setVisitorToken(next);
    detach();
    setConversations([]);
    setBrowsing(false);
    if (wasLive) start();
  }, [detach, start]);

  useEffect(() => () => {
    cancelAnimationFrame(paintRaf.current);
    if (chatRef.current) {
      try {
        chatRef.current.close();
      } catch {
        /* unmounting */
      }
    }
    chatRef.current = null;
  }, []);

  const submitFeedback = useCallback(async (body: { rating?: FeedbackRating; comment?: string; dismiss?: boolean }) => {
    const session = chatRef.current;
    if (!session) throw new Error("chat unavailable");
    const next = body.dismiss
      ? await session.dismissFeedback()
      : await session.rate(body.rating!, body.comment === undefined ? {} : { comment: body.comment });
    if (chatRef.current !== session) return;
    setFeedback(next?.dismissed ? null : next);
  }, []);

  const painting = turns.some((t) => t.streaming);

  return {
    turns,
    feedback,
    submitFeedback,
    typing,
    status,
    conversations,
    browsing,
    setBrowsing,
    chatId,
    connected,
    starting,
    painting,
    stopPainting,
    start,
    submit,
    retry,
    restart,
    openConversation,
    refreshThreads,
    identify,
    resumable: () => vatio.resumable(sessionKeyRef.current),
    sessionKey: () => sessionKeyRef.current
  };
}
