import { useLayoutEffect, useRef } from "react";
import { renderMarkdown } from "../lib/markdown";
import { attachCodeCopyButtons } from "../lib/domCopyButton";
import { CopyButton } from "./CopyButton";
import { FileIcon } from "../lib/icons";
import type { Turn as TurnData, TurnAttachment } from "../hooks/useVatioChat";
import type { Copy } from "../lib/copy";

export function Turn({ turn, copy, onRetry }: { turn: TurnData; copy: Copy; onRetry: (turn: TurnData) => void }) {
  const isUser = turn.role === "user";
  const bodyRef = useRef<HTMLDivElement>(null);
  const html = isUser ? "" : renderMarkdown(turn.text) || "<p></p>";

  // Buttons go on once the text is final: while it is being written the
  // body is replaced every frame, and a copy button that flickers is worse
  // than one that arrives a second late.
  useLayoutEffect(() => {
    if (isUser || turn.streaming || !bodyRef.current) return;
    attachCodeCopyButtons(bodyRef.current, copy.copyText, copy.copied);
  }, [isUser, html, turn.streaming, copy]);

  if (isUser) {
    return (
      <div
        className={"turn user" + (turn.pending ? " pending" : "") + (turn.failed ? " failed" : "")}
        title={turn.failed ? copy.notDelivered : undefined}
        onClick={turn.failed ? () => onRetry(turn) : undefined}
      >
        {turn.attachments?.length ? (
          <div className="files">
            {turn.attachments.map((attachment, index) => <Attachment key={index} attachment={attachment} />)}
          </div>
        ) : null}
        {!turn.mediaLabel && turn.text ? <div className="bubble">{turn.text}</div> : null}
      </div>
    );
  }

  return (
    <div className="turn assistant">
      <div ref={bodyRef} className={"md" + (turn.streaming ? " streaming" : "")} dangerouslySetInnerHTML={{ __html: html }} />
      {!turn.streaming && turn.text.trim() ? (
        <div className="tools">
          <CopyButton className="act" text={turn.text} copy={copy} />
        </div>
      ) : null}
    </div>
  );
}

// A photo is shown, a voice note is a player, anything else is a link to the
// file. While a file-type attachment is still uploading it has no URL yet.
function Attachment({ attachment }: { attachment: TurnAttachment }) {
  const { kind, url, filename } = attachment;
  if (kind === "image" && url) {
    return (
      <a className="file-image" href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={filename} />
      </a>
    );
  }
  if (kind === "audio" && url) return <audio className="file-audio" controls preload="metadata" src={url} />;

  const label = (
    <>
      <FileIcon />
      <span>{filename}</span>
    </>
  );
  return url ? (
    <a className="file-link" href={url} target="_blank" rel="noopener noreferrer">{label}</a>
  ) : (
    <span className="file-link">{label}</span>
  );
}
