import type { ChatButton } from "./sdk";

// A link the agent's reply sends as a button (`buttons` on the message). The
// message's `content` still has it as the agent wrote it, for a client that
// draws no buttons; this one draws the button, so the link comes out of the
// text the same way the backend takes it out of a WhatsApp message
// (Vatio::Runtime::LinkButtons#body): a link that was a line of its own takes
// the line with it, one inside a sentence leaves its words.
export function urlButtons(buttons: ChatButton[] | undefined): ChatButton[] {
  return (buttons || []).filter((button) => button && button.type === "url" && /^https?:\/\//i.test(button.url || ""));
}

const LEFTOVER = /^[\s\p{P}\p{S}]*$/u;

export function withoutButtonLinks(text: string, buttons: ChatButton[]): string {
  return buttons.reduce((current, button) => withoutLink(current, button.url!), text);
}

function withoutLink(text: string, url: string): string {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const markdown = new RegExp("\\[([^\\]\\n]*)\\]\\(" + escaped + "\\)");
  const lines = text.split("\n");
  const index = lines.findIndex((line) => markdown.test(line) || line.includes(url));
  if (index === -1) return text;

  const line = lines[index]!;
  let kept: string | null;
  if (markdown.test(line)) {
    kept = LEFTOVER.test(line.replace(markdown, "")) ? null : line.replace(markdown, (_whole, label: string) => label);
  } else {
    const rest = line.replace(new RegExp(escaped + "\\.?"), "");
    kept = LEFTOVER.test(rest) ? null : rest;
  }
  if (kept === null) lines.splice(index, 1);
  else lines[index] = kept;
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
