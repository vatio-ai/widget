import { FreshIcon } from "../lib/icons";
import type { ConversationEntry } from "../lib/sdk";
import type { Copy } from "../lib/copy";

// "3h", "2d", or a date once it stops being a number anyone can feel. Intl
// does the language, so a new locale costs no new strings here. Ported
// verbatim from shortWhen() in public/vatio-widget.js.
function shortWhen(iso: string | null, lang: string): string {
  const at = Date.parse(iso || "");
  if (!at) return "";

  const seconds = Math.round((Date.now() - at) / 1000);
  const units: Array<[number, string]> = [
    [60, "second"], [3600, "minute"], [86400, "hour"], [604800, "day"]
  ];

  try {
    if (seconds < 604800 && typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
      const format = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "narrow" });
      for (let i = 0; i < units.length; i++) {
        if (seconds < units[i]![0]) {
          const size = i === 0 ? 1 : units[i - 1]![0];
          return format.format(-Math.max(1, Math.floor(seconds / size)), units[i]![1] as Intl.RelativeTimeFormatUnit);
        }
      }
    }
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(new Date(at));
  } catch {
    return "";
  }
}

// The screen the panel opens onto. It used to be a bare list under a "new
// conversation" row, which told a first-time visitor nothing about who they
// had just opened: the lobby answers that first -- the business's picture,
// its name, the line it wrote about itself -- and puts one obvious way in
// under it. Past conversations follow, for the people who have been here
// before; there is no empty state, because for everyone else the lobby is
// the screen and an apology for having no history would be the only thing
// under it.
export function ThreadList({
  name,
  avatarUrl,
  about,
  conversations,
  currentChatId,
  copy,
  onNew,
  onOpen
}: {
  name: string;
  avatarUrl: string | null;
  about: string | null;
  conversations: ConversationEntry[];
  currentChatId: string | number | null;
  copy: Copy;
  onNew: () => void;
  onOpen: (entry: ConversationEntry) => void;
}) {
  return (
    <div id="threads" role="group" aria-label={copy.conversations}>
      <div className="lobby">
        {avatarUrl ? (
          <img className="avatar big" src={avatarUrl} alt="" />
        ) : (
          <span className="avatar big" aria-hidden="true">
            {name.slice(0, 1)}
          </span>
        )}
        <h2 className="who">{name}</h2>
        {about ? <p className="about">{about}</p> : null}
        <button type="button" className="start" onClick={onNew}>
          <FreshIcon />
          <span>{copy.newChat}</span>
        </button>
      </div>

      {conversations.length ? (
        <div className="past">
          <p className="label">{copy.conversations}</p>
          {conversations.map((entry) => (
            <button
              key={entry.chatId}
              type="button"
              className={"thread" + (currentChatId != null && String(entry.chatId) === String(currentChatId) ? " current" : "")}
              onClick={() => onOpen(entry)}
            >
              <div className="top">
                <span className="name">{entry.title || copy.untitled}</span>
                <span className="when">{shortWhen(entry.updatedAt, copy.lang)}</span>
              </div>
              {entry.preview ? <span className="last">{entry.preview}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
