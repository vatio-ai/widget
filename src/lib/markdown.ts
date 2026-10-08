// Ported near-verbatim from public/vatio-widget.js. An agent writes markdown
// whether or not anyone renders it, so this renders the subset a support
// answer actually uses: paragraphs, lists, headings, quotes, rules, links,
// emphasis and code. Every path escapes before it inserts, and the only
// markup that survives is markup this file wrote. It is also fed unfinished
// text on every frame of a stream, so each block form tolerates being cut
// off mid-way: an unclosed fence renders as code to the end rather than
// flickering back to a paragraph when the closing ticks land.
const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)\s*$/;
const BLOCK = /^(?:\s*(?:`{3,}|~{3,})| {0,3}(?:#{1,6}\s|>|(?:[-*+]|\d{1,9}[.)])\s|(?:([-*_])\s*(?:\1\s*){2,}$)))/;
const BULLET = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s+/;

export function renderMarkdown(source: string | null | undefined): string {
  const lines = String(source == null ? "" : source).replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    const fence = line.match(FENCE);
    if (fence) {
      const marker = fence[1]!.charAt(0);
      const width = fence[1]!.length;
      const lang = fence[2] || "";
      // Whatever the fence was indented by is the block's own margin, not
      // part of the command.
      const margin = line.length - line.replace(/^\s+/, "").length;
      const code: string[] = [];
      i++;
      while (i < lines.length) {
        const closing = lines[i]!.match(/^\s*(`{3,}|~{3,})\s*$/);
        if (closing && closing[1]!.charAt(0) === marker && closing[1]!.length >= width) {
          i++;
          break;
        }
        code.push(undent(lines[i]!, margin));
        i++;
      }
      out.push(
        "<pre><code" + (lang ? ' class="lang-' + escapeAttr(lang.replace(/[^\w+#.-]/g, "")) + '"' : "") + ">" +
          escapeHtml(code.join("\n")) + "</code></pre>"
      );
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      // Shifted down two levels: a widget panel is a fragment of somebody
      // else's page, and an <h1> inside it lies about the page's outline.
      const level = Math.min(heading[1]!.length + 2, 6);
      out.push("<h" + level + ">" + inline(heading[2]!) + "</h" + level + ">");
      i++;
      continue;
    }

    if (/^ {0,3}([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i]!)) {
        quote.push(lines[i]!.replace(/^ {0,3}>\s?/, ""));
        i++;
      }
      out.push("<blockquote>" + renderMarkdown(quote.join("\n")) + "</blockquote>");
      continue;
    }

    if (BULLET.test(line)) {
      const ordered = /^ {0,3}\d/.test(line);
      // Steps with a code block between them arrive as several lists, one per
      // step, because the fence ends the list that precedes it. Without the
      // number the list starts at, every step in a set of instructions
      // renders as "1." -- which is the one thing a numbered list is for.
      const first = ordered ? parseInt(line.match(/^ {0,3}(\d{1,9})/)![1]!, 10) : 1;
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i]!)) {
        const item = [lines[i]!.replace(BULLET, "")];
        i++;
        // A wrapped list item: indented, still text, not the next bullet and
        // not a fence the item is introducing.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !BULLET.test(lines[i]!) && !FENCE.test(lines[i]!)) {
          item.push(lines[i]!.replace(/^\s+/, ""));
          i++;
        }
        items.push("<li>" + inline(item.join(" ")) + "</li>");
      }
      const open = ordered ? "<ol" + (first === 1 ? "" : ' start="' + first + '"') + ">" : "<ul>";
      out.push(open + items.join("") + (ordered ? "</ol>" : "</ul>"));
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    // The first line is taken unconditionally, before BLOCK gets a say. It
    // is non-blank and no handler above claimed it, so it is paragraph text
    // whatever it looks like -- and consuming it is what guarantees the loop
    // advances.
    const paragraph = [lines[i]!];
    i++;
    while (i < lines.length && lines[i]!.trim() && !BLOCK.test(lines[i]!)) {
      paragraph.push(lines[i]!);
      i++;
    }
    out.push("<p>" + inline(paragraph.join("\n")).replace(/\n/g, "<br>") + "</p>");
  }

  return out.join("");
}

// Code spans and links come out first and go back last, so the emphasis
// rules in between cannot reach inside `a * b` or mangle a URL's
// underscores, and the autolinker cannot find a URL that is already inside
// an <a href>. The placeholder is a private-use codepoint wrapping an index.
const SLOT = String.fromCharCode(0xe000);
const SLOT_PATTERN = new RegExp(SLOT + "(\\d+)" + SLOT, "g");

function inline(text: string): string {
  const stash: string[] = [];

  function keep(html: string): string {
    stash.push(html);
    return SLOT + (stash.length - 1) + SLOT;
  }

  let work = String(text).replace(/(`+)([\s\S]*?)\1/g, (_whole, _ticks, body) => keep("<code>" + escapeHtml(body) + "</code>"));

  work = escapeHtml(work);

  work = work.replace(/\[([^\]\n]*)\]\(([^)\s]+)(?:\s+&quot;[^\n]*?&quot;)?\)/g, (whole, label, url) => {
    const href = safeUrl(url);
    if (!href) return whole;
    return keep(anchor(href, label || escapeHtml(href)));
  });

  work = work.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/g, (whole, lead, url) => {
    // Trailing punctuation belongs to the sentence, not to the link.
    const trail = url.match(/(?:&(?:amp|quot|#39|lt|gt);|[.,;:!?)\]}'])+$/);
    const bare = trail ? url.slice(0, url.length - trail[0].length) : url;
    const href = safeUrl(bare);
    if (!href) return whole;
    return lead + keep(anchor(href, bare)) + (trail ? trail[0] : "");
  });

  work = work
    .replace(/\*\*\*([^\n*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^\n*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^\n*]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])__([^\n_]+)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/(^|[^\w_])_([^\n_]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^\n~]+)~~/g, "<s>$1</s>");

  return work.replace(SLOT_PATTERN, (whole, index) => {
    const held = stash[Number(index)];
    return held === undefined ? whole : held;
  });
}

// Drops up to `width` columns of leading whitespace -- never more, so the
// relative indentation inside a code block survives.
function undent(line: string, width: number): string {
  let n = 0;
  while (n < width && (line.charAt(n) === " " || line.charAt(n) === "\t")) n++;
  return line.slice(n);
}

// A link into the host site navigates the page the widget is sitting on, the
// way any link on that page would; only a link elsewhere gets a new tab.
function anchor(href: string, label: string): string {
  const external = sameOrigin(href) ? "" : ' target="_blank" rel="noopener noreferrer nofollow"';
  return '<a href="' + escapeAttr(href) + '"' + external + ">" + label + "</a>";
}

function sameOrigin(href: string): boolean {
  try {
    return new URL(href).origin === window.location.origin;
  } catch {
    return false;
  }
}

// Only schemes a visitor can be sent to safely. A relative path is dropped
// rather than resolved: relative to the host page it means nothing the
// agent intended, and relative to Vatio it is not a link the agent asked for.
function safeUrl(url: string): string | null {
  const value = String(url).trim().replace(/&amp;/g, "&");
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  if (/^(?:mailto|tel):\S+$/i.test(value)) return value;
  if (/^www\.\S+$/i.test(value)) return "https://" + value;
  return null;
}

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}
