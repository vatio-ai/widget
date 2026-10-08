// Copy buttons for code blocks specifically: the block itself comes from
// renderMarkdown() as raw HTML (dangerouslySetInnerHTML), so a React
// component can't live inside it -- this attaches a plain-DOM button the
// same way public/vatio-widget.js's decorate() did, reusing the identical
// icon markup. The per-message copy button (MessageBody's "tools" row) is
// a real React component; this is only for buttons that have to sit inside
// injected HTML.
const COPY_SVG = '<svg class="copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
const CHECK_SVG = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

export function attachCodeCopyButtons(container: HTMLElement, copyLabel: string, copiedLabel: string) {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector("button.copy")) return;

    const source = pre.textContent || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy";
    button.setAttribute("aria-label", copyLabel);
    button.innerHTML = COPY_SVG;

    button.addEventListener("click", () => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(source).then(
        () => {
          button.innerHTML = CHECK_SVG;
          button.setAttribute("aria-label", copiedLabel);
          setTimeout(() => {
            button.innerHTML = COPY_SVG;
            button.setAttribute("aria-label", copyLabel);
          }, 1400);
        },
        () => {
          /* denied or insecure context; nothing to say about it */
        }
      );
    });

    pre.appendChild(button);
  });
}
