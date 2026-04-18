/** Preset moods: instruction text appended for TTS-friendly, mood-aware replies */
export const DIRECTOR_MOOD_INSTRUCTIONS = {
  neutral:
    "Use a clear, balanced, conversational tone suited to being read aloud.",
  warm: "Use a warm, supportive, and personable tone; sound like a friendly guide.",
  calm: "Use a calm, soothing, measured tone with steady pacing in how you phrase ideas.",
  energetic:
    "Use an upbeat, lively tone while staying accurate; short punchy sentences are welcome when they fit.",
  dramatic:
    "Use vivid, expressive language when appropriate—still natural for speech, not theatrical stage directions unless the user asks.",
  humorous:
    "Use light wit and playful language when it fits; stay respectful and never mean-spirited.",
  melancholic:
    "When it suits the topic, allow a gentle, reflective, or subdued emotional color—never performative grief.",
  professional:
    "Use a polished, confident, professional tone suitable for a spoken briefing or podcast.",
  custom: null,
};

/** Verbatim system text — do not alter spacing, punctuation, or backticks */
export const DIRECTOR_SUPPORTED_TAGS_LINE =
  "Supported tags: `[laughter]`, `[sigh]`, `[confirmation-en]`, `[question-en]`, `[question-ah]`, `[question-oh]`, `[question-ei]`, `[question-yi]`, `[surprise-ah]`, `[surprise-oh]`, `[surprise-wa]`, `[surprise-yo]`, `[dissatisfaction-hnn]`.";

export const DIRECTOR_MOOD_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "warm", label: "Warm" },
  { value: "calm", label: "Calm" },
  { value: "energetic", label: "Energetic" },
  { value: "dramatic", label: "Dramatic" },
  { value: "humorous", label: "Humorous" },
  { value: "melancholic", label: "Reflective" },
  { value: "professional", label: "Professional" },
  { value: "custom", label: "Custom" },
];

/**
 * Extra system instructions when Director mode is on and TTS is active.
 * @param {object} textFormatConfig
 * @returns {string | null}
 */
export function getDirectorModeSystemAppendix(textFormatConfig) {
  if (!textFormatConfig?.directorMode) return null;

  const moodKey = textFormatConfig.directorMood || "neutral";
  let moodLine =
    DIRECTOR_MOOD_INSTRUCTIONS[moodKey] ||
    DIRECTOR_MOOD_INSTRUCTIONS.neutral;

  if (moodKey === "custom") {
    const custom = (textFormatConfig.directorMoodCustom || "").trim();
    moodLine = custom
      ? `Apply this mood to spoken-style replies (this instruction line is English; the snippet may be in any language—infer intent): ${custom}`
      : "Follow a neutral, clear tone suited to speech (custom mood was left empty).";
  }

  return [
    "## Director mode (text-to-speech)",
    "**Instructions language:** This entire section is written in English for the API. Do not translate this block into another language. You may still answer the user in Spanish or any language that fits the conversation—these English rules describe how to shape tone, pacing, and speech-friendly form.",
    "Your replies will be converted to speech. Write so they sound natural when read aloud: prefer clear sentences, sensible rhythm, and wording that matches the mood below in whatever language you use for the user.",
    DIRECTOR_SUPPORTED_TAGS_LINE,
    "Avoid relying on markdown, tables, or ASCII art for meaning; if you must mention code, keep spoken explanations self-contained.",
    `**Mood (English instructions—apply in the reply language):** ${moodLine}`,
  ].join("\n");
}
