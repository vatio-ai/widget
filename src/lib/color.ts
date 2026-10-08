// Ported verbatim from public/vatio-widget.js.
function channels(color: string): [number, number, number] | null {
  let hex = String(color).trim().replace("#", "");
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return [r!, g!, b!];
}

function luminance(rgb: [number, number, number]): number {
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

// Black or white, whichever the accent can carry. Same relative-luminance
// rule WCAG uses, so a pale accent gets dark text instead of unreadable white.
export function readableInk(color: string): string {
  const rgb = channels(color);
  if (!rgb) return "#ffffff";
  return luminance(rgb) > 0.42 ? "#111827" : "#ffffff";
}

// A near-black brand accent is a fine bubble colour on a white page and an
// invisible one on a dark panel, so on the dark scheme it gets mixed toward
// white until it separates from the surface. Brands that are already bright
// enough are left exactly as they are.
export function liftForDark(color: string): string {
  const rgb = channels(color);
  if (!rgb || luminance(rgb) >= 0.12) return color;

  return (
    "#" +
    rgb
      .map((value) => {
        const lifted = Math.round(value + (255 - value) * 0.45);
        return (lifted < 16 ? "0" : "") + lifted.toString(16);
      })
      .join("")
  );
}
