import { useState } from "react";
import { CheckIcon, CopyIcon } from "../lib/icons";
import type { Copy } from "../lib/copy";

// Ported from copyButton() in public/vatio-widget.js: icon swaps to a
// checkmark for 1400ms after a successful copy. State lives in React here
// instead of being toggled by hand, which is the one place this port
// deliberately diverges from the original's imperative DOM code -- the
// visual contract (icon, timing, aria-label swap) is unchanged.
export function CopyButton({ className, text, copy }: { className: "copy" | "act"; text: string; copy: Copy }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      aria-label={copied ? copy.copied : copy.copyText}
      onClick={() => {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          },
          () => {
            /* denied or insecure context; nothing to say about it */
          }
        );
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
