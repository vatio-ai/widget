import type { AppConfig } from "./App";
import { mountShadowWidget } from "./shadowMount";
import type { ChatMessage, ChatSession, ChatStatus, ConversationEntry, MessageUpdate, RemoteConfig, ReplyStyle, SessionKey, VatioSdk } from "./lib/sdk";
import { replyStyleFrom } from "./lib/config";
import { kindOf } from "./lib/files";
import type { FeedbackRating, VisitorFeedback } from "./lib/feedback";

// A fake Vatio SDK so `npm run dev` gives instant hot-reload on <App>
// without a real workspace/token/backend. Not a contract to keep in step
// with `@vatio-ai/sdk` -- just enough behavior to exercise streaming,
// history and the conversation list. It implements src/lib/sdk.ts, which is
// why that file stays a hand-written view of the SDK rather than its types.
class FakeSession implements ChatSession {
  chatId = "dev-chat-1";
  environment = "dev";
  private log: ChatMessage[] = [];
  private onMessage: ((message: ChatMessage) => void) | null = null;
  private onTyping: ((isTyping: boolean) => void) | null = null;
  private onFeedback: ((feedback: VisitorFeedback | null) => void) | null = null;
  private onUpdate: ((update: MessageUpdate) => void) | null = null;
  private nextMessageId = 1;
  private replies = 0;

  constructor(private replyStyle: ReplyStyle) {}

  on(event: "message", handler: (message: ChatMessage) => void): void;
  on(event: "typing", handler: (isTyping: boolean) => void): void;
  on(event: "status", handler: (status: ChatStatus) => void): void;
  on(event: "error", handler: (error: { message?: string } | null) => void): void;
  on(event: "feedback", handler: (feedback: VisitorFeedback | null) => void): void;
  on(event: "update", handler: (update: MessageUpdate) => void): void;
  on(event: string, handler: (value: never) => void): void {
    if (event === "update") this.onUpdate = handler as (update: MessageUpdate) => void;
    if (event === "message") this.onMessage = handler as (message: ChatMessage) => void;
    if (event === "typing") this.onTyping = handler as (isTyping: boolean) => void;
    if (event === "feedback") this.onFeedback = handler as (feedback: VisitorFeedback | null) => void;
  }

  // Offered after the third reply, so the card can be worked on without a
  // backend deciding when a conversation is resolved.
  private moment: VisitorFeedback | null = null;

  async rate(rating: FeedbackRating) {
    if (!this.moment) return null;
    this.moment = { ...this.moment, rating, submittedAt: new Date().toISOString() };
    return this.moment;
  }

  async dismissFeedback() {
    if (!this.moment) return null;
    this.moment = { ...this.moment, dismissed: true };
    return this.moment;
  }

  async history() {
    return this.log;
  }

  // Files come back as object URLs, and a voice note gets a made-up
  // transcript a moment later, the way the backend's job delivers one.
  async send(text: string, options: { files?: File[] } = {}) {
    const files = options.files || [];
    const id = this.nextMessageId++;
    const audio = files.some((file) => kindOf(file) === "audio");
    const label = files.length && !text ? (audio ? "Audio" : kindOf(files[0]!) === "image" ? "Image" : files[0]!.name) : "";
    const message: ChatMessage = {
      id,
      role: "user",
      content: text || label,
      content_is_media_label: Boolean(label),
      attachments: files.map((file) => ({ filename: file.name, content_type: file.type, kind: kindOf(file), url: URL.createObjectURL(file) }))
    };
    this.log.push(message);
    if (audio) {
      setTimeout(() => this.onUpdate?.({ id, content: "(dev) Transcript of the voice note.", content_is_media_label: false }), 1200);
    }
    void this.reply(text || label);
    return { message };
  }

  private async reply(text: string) {
    if (this.replyStyle === "paced") return this.replyPaced(text);
    this.onTyping?.(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.onTyping?.(false);
    const reply = `You said: **${text}**\n\nHere's a fenced example:\n\n\`\`\`js\nconsole.log("hello from dev-main.tsx");\n\`\`\`\n\nAnd a list:\n\n1. Edit \`src/App.tsx\`\n2. Save\n3. Watch it hot-reload`;
    this.log.push({ role: "assistant", content: reply });
    this.onMessage?.({ role: "assistant", content: reply });
    this.replies += 1;
    if (this.replies === 3) {
      this.moment = { agentName: "Dev Agent", messageId: this.replies, rating: null, submittedAt: null, dismissed: false };
      this.onFeedback?.(this.moment);
    }
  }

  // What PacedReplyDeliveryJob sends: typing before each bubble, and one
  // typing stop after the last.
  private async replyPaced(text: string) {
    const bubbles = [`You said: **${text}**`, "This is the second bubble, a moment later.", "And a third, to close."];
    for (const bubble of bubbles) {
      this.onTyping?.(true);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      this.log.push({ role: "assistant", content: bubble });
      this.onMessage?.({ role: "assistant", content: bubble });
    }
    this.onTyping?.(false);
  }

  close() {}
}

const DEV_ABOUT = "The dev harness's stand-in for vatio.yml's widget.about — a line or two about the business, shown on the panel's opening screen.";

const vatio: VatioSdk = {
  async config(): Promise<RemoteConfig> {
    return { theme: { accent: "#4f46e5" }, agent: { name: "Dev Agent", avatar_url: null, about: DEV_ABOUT }, locale: null };
  },
  async chat({ replyStyle }) {
    return new FakeSession(replyStyle);
  },
  resumable(_key: SessionKey) {
    return false;
  },
  reset(_key: SessionKey) {},
  async conversations(_key): Promise<ConversationEntry[]> {
    return [
      { chatId: "dev-chat-0", title: "An earlier conversation", updatedAt: new Date(Date.now() - 3_600_000).toISOString(), preview: "Thanks, that fixed it!" }
    ];
  }
};

const config: AppConfig = {
  workspace: "dev",
  token: "vatpub_dev",
  baseUrl: "http://localhost",
  sessionScope: null,
  inline: false,
  subtitle: null,
  initialVisitorToken: null,
  title: null,
  about: null,
  greeting: "Hi! What can I help with?",
  locale: "en",
  suggestions: ["Pricing", "Book a demo", "Talk to a human"],
  // `?reply-style=paced` shows what a paced workspace's visitors see.
  replyStyle: replyStyleFrom(new URLSearchParams(location.search).get("reply-style"))
};

const root = document.getElementById("root");
if (root) {
  // Same mounting path as start.ts (mountShadowWidget), so the dev harness
  // is styled and themed identically to production -- only the config and
  // the SDK are fake here.
  mountShadowWidget({
    container: root,
    theme: { accent: null, accentInk: null, surface: null, ink: null, muted: null, line: null, radius: "16px", font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    remoteAccent: "#4f46e5",
    scheme: "auto",
      position: "right",
    lang: "en",
    app: {
      vatio,
      config,
      remote: { theme: { accent: "#4f46e5" }, agent: { name: "Dev Agent", avatar_url: null, about: DEV_ABOUT }, locale: null },
      onReady: () => {}
    }
  });
}
