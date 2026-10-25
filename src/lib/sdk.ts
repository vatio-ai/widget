import type { FeedbackRating, VisitorFeedback } from "./feedback";

// The shape of the Vatio SDK contract, as this app uses it (../../../sdk,
// published as `@vatio-ai/sdk` and bundled into widget.js -- see README.md).
//
// Still a hand-written view of the SDK rather than its own exported types,
// even now that the import is static: what this file declares is the subset
// the widget depends on, so a change to the SDK that this app does not use
// is not a change to anything here. It is also what src/dev-main.tsx's fake
// implements, which is how the dev server runs with no backend at all.
export interface ChatAttachment {
  filename: string;
  content_type?: string;
  kind: "image" | "audio" | "video" | "file";
  url: string | null;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  // `content` is only a stand-in ("Image", "Audio") for a file-only message.
  content_is_media_label?: boolean;
}

// A message that changed after it was sent: a voice note's transcript.
export interface MessageUpdate {
  id: number;
  content: string;
  content_is_media_label: boolean;
}

export interface ConversationEntry {
  chatId: string | number;
  title: string | null;
  updatedAt: string | null;
  preview: string | null;
}

export type ChatStatus = "connected" | "reconnecting";

// The two the widget renders. The SDK's third, "instant", is for a program
// polling for a finished answer, not for somebody reading.
export type ReplyStyle = "stream" | "paced";

export interface ChatSession {
  chatId: string | number;
  chatToken?: string;
  environment: string;
  on(event: "message", handler: (message: ChatMessage) => void): void;
  on(event: "typing", handler: (isTyping: boolean) => void): void;
  on(event: "status", handler: (status: ChatStatus) => void): void;
  on(event: "error", handler: (error: { message?: string } | null) => void): void;
  on(event: "feedback", handler: (feedback: VisitorFeedback | null) => void): void;
  on(event: "update", handler: (update: MessageUpdate) => void): void;
  rate(rating: FeedbackRating, options?: { comment?: string }): Promise<VisitorFeedback | null>;
  dismissFeedback(): Promise<VisitorFeedback | null>;
  history(): Promise<ChatMessage[]>;
  send(text: string, options?: { files?: File[] }): Promise<{ message?: ChatMessage } | void>;
  close(): void;
}

export interface SessionKey {
  workspace: string;
  baseUrl: string;
  scope: string | null;
  visitorToken: string | null;
}

// What /config serves. Everything outside `agent` is a *default* the host
// page may still override with the matching `data-*` attribute — the snippet
// is two attributes because it no longer has to repeat the workspace's answer,
// not because it lost the ability to disagree with it.
//
// Every field past `accent` is optional on purpose: an older platform does not
// send them, and a workspace that has not set one leaves it out rather than
// sending null. Absent means "the page decides", which is what the widget did
// before any of this existed.
// snake_case, because that is what this API speaks (`avatar_url` next door).
// The camelCase equivalents live on ThemeConfig, which is the widget's own
// shape rather than the wire's.
export interface RemoteTheme {
  accent: string | null;
  accent_ink?: string | null;
  surface?: string | null;
  ink?: string | null;
  muted?: string | null;
  line?: string | null;
  radius?: string | null;
  font?: string | null;
}

export interface RemoteUi {
  position?: string | null;
  scheme?: string | null;
  reply_style?: string | null;
  title?: string | null;
  greeting?: string | null;
  suggestions?: string[] | null;
}

export interface RemoteConfig {
  theme: RemoteTheme;
  ui?: RemoteUi | null;
  agent: { name: string | null; avatar_url: string | null; about: string | null } | null;
  locale: string | null;
}

export interface VatioSdk {
  config(args: { workspace: string; token: string; baseUrl: string }): Promise<RemoteConfig>;
  chat(args: {
    workspace: string;
    token: string;
    baseUrl: string;
    scope: string | null;
    visitorToken: string | null;
    conversation: ConversationEntry | null;
    replyStyle: ReplyStyle;
    widget: boolean;
  }): Promise<ChatSession>;
  resumable(key: SessionKey): boolean;
  reset(key: SessionKey): void;
  conversations?(key: SessionKey & { token: string }): Promise<ConversationEntry[]>;
}
