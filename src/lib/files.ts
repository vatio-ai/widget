// What the composer lets a visitor attach. The same list and limits the
// server enforces (Vatio::PublicApi::VisitorUploads), checked here so a file
// it would refuse never uploads. The server stays the authority: it reads
// the bytes, this only reads the type the browser guessed.
export const MAX_FILES = 4;
export const MAX_BYTES = 8 * 1024 * 1024;

const TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "application/pdf", "text/plain", "text/csv", "text/markdown",
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/ogg", "audio/wav",
  "audio/x-wav", "audio/wave", "audio/flac", "audio/x-flac"
];
// A browser leaves `type` empty for extensions it does not know (.heic and
// .md on most, .m4a on some), so the extension is the fallback.
const EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf", "txt", "csv", "md",
  "mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac"
];

export const ACCEPT = [...TYPES, ...EXTENSIONS.map((ext) => "." + ext)].join(",");

export type FileProblem = "tooLarge" | "unsupported";

export function problemWith(file: File): FileProblem | null {
  if (file.size > MAX_BYTES) return "tooLarge";
  const type = (file.type.split(";")[0] || "").trim().toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (TYPES.includes(type) || (!type && EXTENSIONS.includes(ext))) return null;
  return "unsupported";
}

export function kindOf(file: { type?: string; content_type?: string; name?: string; filename?: string }): "image" | "audio" | "file" {
  const type = (file.type || file.content_type || "").toLowerCase();
  const ext = (file.name || file.filename || "").split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) return "image";
  if (type.startsWith("audio/") || ["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac"].includes(ext)) return "audio";
  return "file";
}
