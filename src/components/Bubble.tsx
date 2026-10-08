import { ChatIcon, CloseIcon } from "../lib/icons";

export function Bubble({ open, name, onClick }: { open: boolean; name: string; onClick: () => void }) {
  return (
    <button id="bubble" type="button" className={open ? "open" : ""} aria-label={name} aria-expanded={open} onClick={onClick}>
      <ChatIcon />
      <CloseIcon className="x" />
    </button>
  );
}
