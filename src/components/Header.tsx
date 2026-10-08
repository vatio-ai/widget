import { BackIcon, CloseIcon } from "../lib/icons";
import type { Copy } from "../lib/copy";

// One header for both screens, so the close button is always in the same
// place -- the list used to be headerless, which left the panel with no way
// out of it. Which of the two it is showing is a matter of CSS: #panel
// .browsing hides the identity here, because the list carries it in full
// (see ThreadList's lobby) and saying it twice on one screen is noise.
export function Header({
  name,
  avatarUrl,
  copy,
  subtitle,
  backOn,
  onBack,
  onClose
}: {
  name: string;
  avatarUrl: string | null;
  copy: Copy;
  subtitle?: string | null;
  backOn: boolean;
  onBack: () => void;
  // Absent in inline mode, which has nothing to close.
  onClose?: () => void;
}) {
  return (
    <header>
      <button id="back" type="button" className={backOn ? "on" : ""} aria-label={copy.allChats} onClick={onBack}>
        <BackIcon />
      </button>
      {avatarUrl ? (
        <img className="avatar" src={avatarUrl} alt="" width={28} height={28} />
      ) : (
        <span className="avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
      {subtitle ? (
        <span className="ident">
          <span className="who">{name}</span>
          <span className="sub">{subtitle}</span>
        </span>
      ) : (
        <span className="who">{name}</span>
      )}
      {onClose ? (
        <span className="tools">
          <button id="close" type="button" aria-label={copy.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </span>
      ) : null}
    </header>
  );
}
