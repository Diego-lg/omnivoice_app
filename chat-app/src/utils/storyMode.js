/** Max characters of prior story sent back to the model (tail) to control tokens. */
export const STORY_CONTEXT_MAX_CHARS = 14_000;

export const STORY_SEGMENT_MAX_TOKENS = 640;

/** @typedef {"en" | "es"} StoryLanguage */

const STORY_NARRATOR_SYSTEM_EN = `You are a storyteller for continuous spoken narration. Output plain prose only—no titles, no chapter labels, no bullet lists, no meta commentary to the listener. Never ask the listener questions or explain that you are an AI. Use vivid sensory detail and natural pacing.`;

const STORY_NARRATOR_SYSTEM_ES = `Eres un narrador de historias para audio continuo. Escribe solo prosa: sin títulos, sin encabezados de capítulo, sin listas, sin comentarios meta al oyente. No hagas preguntas al oyente ni expliques que eres una IA. Usa detalles sensoriales vivos y un ritmo natural.`;

const STORY_CONTINUE_USER_EN =
  "Continue the same narrative from the very next sentence. Write only the next section (several paragraphs). Do not repeat, recap, or summarize earlier events; advance the plot and setting.";

const STORY_CONTINUE_USER_ES =
  "Continúa la misma narración desde la siguiente frase. Escribe solo la siguiente parte (varios párrafos). No repitas, recapitules ni resumas lo anterior; avanza la trama y el escenario.";

/**
 * @param {StoryLanguage} lang
 */
export function getStoryNarratorSystem(lang) {
  return lang === "es" ? STORY_NARRATOR_SYSTEM_ES : STORY_NARRATOR_SYSTEM_EN;
}

/**
 * OmniVoice `generation_config.language` hint for story playback.
 * @param {StoryLanguage} lang
 */
export function getStoryTtsLanguageCode(lang) {
  return lang === "es" ? "es" : "en";
}

/**
 * @param {string} seed optional user hint (genre, characters, etc.)
 * @param {StoryLanguage} lang
 */
export function buildStoryStartUserMessage(seed, lang) {
  const hint = seed?.trim();
  if (lang === "es") {
    if (hint) {
      return `Comienza una historia de ficción original para narración hablada. El oyente pidió esta dirección (síguela de cerca): ${hint}\n\nEscribe solo la apertura—varios párrafos de prosa vívida. Solo narra; sin prefacios ni explicaciones. Todo en español.`;
    }
    return `Comienza una historia de ficción original para narración hablada. Inventa personajes y una situación atractiva. Escribe solo la apertura—varios párrafos de prosa vívida. Solo narra; sin prefacios ni explicaciones. Todo en español.`;
  }
  if (hint) {
    return `Begin an original fictional story for spoken narration. The listener asked for this direction (follow it closely): ${hint}\n\nWrite the opening section only—several paragraphs of vivid prose. Narrate only; do not preface or explain. Write entirely in English.`;
  }
  return `Begin an original fictional story for spoken narration. Invent engaging characters and a clear situation. Write the opening section only—several paragraphs of vivid prose. Narrate only; do not preface or explain. Write entirely in English.`;
}

function storyContinueUser(lang) {
  return lang === "es" ? STORY_CONTINUE_USER_ES : STORY_CONTINUE_USER_EN;
}

/**
 * MiniMax messages for the next story segment.
 * @param {{ role: string, content: string }} systemMessage
 * @param {string} startUserText first user message (frozen for the session)
 * @param {string} storySoFar full concatenated assistant prose so far
 * @param {StoryLanguage} lang
 */
export function buildStoryChatMessages(
  systemMessage,
  startUserText,
  storySoFar,
  lang = "en",
) {
  const tail =
    storySoFar.length > STORY_CONTEXT_MAX_CHARS
      ? storySoFar.slice(-STORY_CONTEXT_MAX_CHARS)
      : storySoFar;

  if (!tail) {
    return [systemMessage, { role: "user", content: startUserText }];
  }

  return [
    systemMessage,
    { role: "user", content: startUserText },
    { role: "assistant", content: tail },
    { role: "user", content: storyContinueUser(lang) },
  ];
}
