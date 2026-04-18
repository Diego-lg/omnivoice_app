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
