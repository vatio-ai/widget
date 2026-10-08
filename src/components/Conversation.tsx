import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { Feedback } from "./Feedback";
import type { FeedbackRating, VisitorFeedback } from "../lib/feedback";
import { Intro } from "./Intro";
import { Turn } from "./Turn";
import { CloseIcon, DownIcon, FileIcon, PaperclipIcon, SendIcon, StopIcon } from "../lib/icons";
import { ACCEPT, MAX_FILES, kindOf, problemWith } from "../lib/files";
import type { Turn as TurnData } from "../hooks/useVatioChat";
import type { Copy } from "../lib/copy";

// #list + #dock (jump / status / composer / credit), ported from mount()'s
// DOM in public/vatio-widget.js. Kept as one component because the jump
// button's visibility and the composer's autogrow both react to the same
// list, and splitting them would just mean passing that state back up and
// down again.
export function Conversation({
  workspace,
  turns,
  feedback,
  onFeedback,
  typing,
  paced,
  showIntro,
  introName,
  introAvatarUrl,
  greeting,
  suggestions,
  status,
  painting,
  copy,
  onSuggestion,
  onRetry,
  onStop,
  onSubmit,
  focusSignal
}: {
  workspace: string;
  turns: TurnData[];
  feedback: VisitorFeedback | null;
  onFeedback: (body: { rating?: FeedbackRating; comment?: string; dismiss?: boolean }) => Promise<void>;
  typing: boolean;
  paced: boolean;
  showIntro: boolean;
  introName: string;
  introAvatarUrl: string | null;
  greeting: string | null;
  suggestions: string[];
  status: { text: string; busy: boolean };
  painting: boolean;
  copy: Copy;
  onSuggestion: (text: string) => void;
  onRetry: (turn: TurnData) => void;
  onStop: () => void;
  onSubmit: (text: string, files: File[]) => void;
  focusSignal: number;
}) {
  const creditUrl = "https://vatio.ai/?" + new URLSearchParams({
    utm_source: "vatio_widget",
    utm_medium: "referral",
    utm_campaign: "powered_by",
    utm_content: workspace
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileNotice, setFileNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The hint that files can be dropped here, shown when a conversation
  // opens. It goes once the visitor has attached something or closed it. A
  // touch screen cannot drag, so there it says "attach" instead.
  const [hintClosed, setHintClosed] = useState(false);
  const usedFiles = useRef(false);
  const canDrag = typeof window === "undefined" || !window.matchMedia || !window.matchMedia("(pointer: coarse)").matches;
  const lastTurnCount = useRef(0);

  // The composer's own previews of what is about to be sent.
  const previews = useRef(new Map<File, string>());
  function previewOf(file: File): string | null {
    if (kindOf(file) !== "image") return null;
    let url = previews.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      previews.current.set(file, url);
    }
    return url;
  }
  useEffect(() => {
    previews.current.forEach((url, file) => {
      if (files.includes(file)) return;
      URL.revokeObjectURL(url);
      previews.current.delete(file);
    });
  }, [files]);

  function addFiles(incoming: FileList | File[] | null | undefined) {
    const list = Array.from(incoming || []);
    if (!list.length) return;
    usedFiles.current = true;
    setHintClosed(true);
    const accepted = list.filter((file) => !problemWith(file));
    const problem = list.map(problemWith).find(Boolean);
    const room = MAX_FILES - files.length;
    if (accepted.length > room) setFileNotice(copy.tooManyFiles);
    else if (problem === "tooLarge") setFileNotice(copy.fileTooLarge);
    else if (problem === "unsupported") setFileNotice(copy.fileUnsupported);
    else setFileNotice("");
    if (room > 0 && accepted.length) setFiles((prev) => [...prev, ...accepted.slice(0, room)]);
    inputRef.current?.focus();
  }

  // Drag events fire on every child the pointer crosses; counting them is
  // what tells a real leave from moving over the list's own contents.
  const dropHandlers = {
    onDragEnter(event: DragEvent<HTMLElement>) {
      if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop(event: DragEvent<HTMLElement>) {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      addFiles(event.dataTransfer.files);
    }
  };

  function atBottom() {
    const list = listRef.current;
    if (!list) return true;
    return list.scrollHeight - list.scrollTop - list.clientHeight < 90;
  }

  function stick(force?: boolean) {
    if (!force && !following) return;
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  // The visitor just sent something, so that one scroll is not a
  // suggestion, same as addUser()'s forced stick() in the original.
  useLayoutEffect(() => {
    const last = turns[turns.length - 1];
    const grew = turns.length > lastTurnCount.current;
    lastTurnCount.current = turns.length;
    if (grew && last && last.role === "user") {
      setFollowing(true);
      stick(true);
    } else {
      stick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns]);

  useEffect(() => {
    if (typing || feedback) stick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, feedback]);

  // Opening the panel or a conversation shows the hint again, until the
  // visitor has attached something once.
  useEffect(() => {
    if (!usedFiles.current) setHintClosed(false);
  }, [focusSignal]);

  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    inputRef.current?.focus();
  }, [focusSignal]);

  // The finished text is announced once -- the list itself can't be a live
  // region, a streaming answer rewrites it every frame.
  useEffect(() => {
    const last = turns[turns.length - 1];
    if (last && last.role === "assistant" && !last.streaming && liveRef.current) liveRef.current.textContent = last.text;
  }, [turns]);

  function autogrow() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }

  function submitForm() {
    // While an answer is still being written, Send is a Stop button.
    // Sending anyway is allowed and lands the rest of the answer first, so
    // the transcript never shows a question above a half-written reply.
    if (painting) {
      onStop();
      if (!value.trim() && !files.length) return;
    }
    const text = value.trim();
    if (!text && !files.length) return;
    setValue("");
    setFiles([]);
    setFileNotice("");
    setHintClosed(true);
    requestAnimationFrame(autogrow);
    onSubmit(text, files);
  }

  const showHint = !hintClosed && !files.length && !fileNotice;

  return (
    <>
      <div id="list" className={paced ? "paced" : undefined} role="log" ref={listRef} onScroll={() => setFollowing(atBottom())} {...dropHandlers}>
        {showIntro ? (
          <Intro name={introName} avatarUrl={introAvatarUrl} greeting={greeting} suggestions={suggestions} onSuggestion={onSuggestion} />
        ) : null}
        {turns.map((turn) => (
          <Turn key={turn.id} turn={turn} copy={copy} onRetry={onRetry} />
        ))}
        {feedback && !typing && !painting && !turns.some((turn) => turn.pending) ?
          <Feedback key={feedback.messageId} feedback={feedback} copy={copy} onSubmit={onFeedback} /> : null}
        <div id="typing" className={typing ? "on" : ""} aria-hidden="true">
          <i /><i /><i />
        </div>
      </div>
      <div id="dock" {...dropHandlers}>
        <button
          id="jump"
          type="button"
          className={following ? "" : "on"}
          aria-label={copy.latest}
          onClick={() => {
            setFollowing(true);
            stick(true);
            inputRef.current?.focus();
          }}
        >
          <DownIcon />
        </button>
        <p id="status" role="status" aria-live="polite" className={status.text ? "on" + (status.busy ? " busy" : "") : ""}>
          {status.text}
        </p>
        {showHint ? (
          <p id="drop-hint">
            <PaperclipIcon />
            <span>{canDrag ? copy.dragHint : copy.attachHint}</span>
            <button type="button" aria-label={copy.dismiss} onClick={() => setHintClosed(true)}>
              <CloseIcon />
            </button>
          </p>
        ) : null}
        {fileNotice ? <p id="file-notice" role="status">{fileNotice}</p> : null}
        {files.length ? (
          <ul id="tray">
            {files.map((file, index) => {
              const preview = previewOf(file);
              return (
                <li key={index}>
                  {preview ? <img src={preview} alt="" /> : <FileIcon />}
                  <span>{file.name}</span>
                  <button
                    type="button"
                    aria-label={copy.removeFile + " " + file.name}
                    onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
                  >
                    <CloseIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <form
          id="form"
          onSubmit={(event) => {
            event.preventDefault();
            submitForm();
          }}
        >
          <div id="composer">
            <button id="attach" type="button" aria-label={copy.attach} title={copy.attach} onClick={() => fileInputRef.current?.click()}>
              <PaperclipIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              onChange={(event) => {
                addFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <textarea
              id="input"
              ref={inputRef}
              rows={1}
              autoComplete="off"
              placeholder={copy.placeholder}
              aria-label={copy.message}
              value={value}
              onChange={(event) => {
                setValue(event.currentTarget.value);
                autogrow();
              }}
              onPaste={(event) => {
                // A screenshot pasted into the box is a file, not text.
                const pasted = Array.from(event.clipboardData?.files || []);
                if (!pasted.length) return;
                event.preventDefault();
                addFiles(pasted);
              }}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line. isComposing is
                // the IME guard: mid composition, Enter accepts a
                // candidate, it does not send.
                if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
                if (event.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                submitForm();
              }}
            />
            <button
              id="send"
              type="submit"
              className={painting ? "stopping" : ""}
              aria-label={painting ? copy.stop : copy.send}
              disabled={!painting && !value.trim() && !files.length}
            >
              <SendIcon />
              <StopIcon />
            </button>
          </div>
        </form>
        <p id="credit">
          <a href={creditUrl} target="_blank" rel="noopener noreferrer">
            Powered by vatio.ai
          </a>
        </p>
      </div>
      <div id="drop" className={dragging ? "on" : ""} aria-hidden="true">
        <PaperclipIcon />
        <span>{copy.dropHere}</span>
      </div>
      <div id="live" ref={liveRef} aria-live="polite" />
    </>
  );
}
