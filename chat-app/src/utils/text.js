/**
 * Remove emoji and emoticon characters from a string.
 * Covers the full Unicode emoji ranges including flags, symbols, and ZWJ sequences.
 */
export function stripEmojis(text) {
  if (!text) return text;
  return text
    .replace(
      /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA9F}]|[\u{1FAA0}-\u{1FAFF}]|\u{200D}|\u{FE0F}/gu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Turn assistant markdown into plain text suitable for speech synthesis.
 * Display can stay markdown; TTS should not read hashes, stars, or code fences.
 */
export function prepareTextForTts(raw) {
  if (!raw) return "";
  let s = raw;

  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_\n]+)_/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  s = s.replace(/^[-*_]{3,}\s*$/gm, " ");
  s = s.replace(/^>\s?/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  s = s.replace(/^\|.*\|\s*$/gm, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/\|{2,}/g, " ");
  s = stripEmojis(s);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
