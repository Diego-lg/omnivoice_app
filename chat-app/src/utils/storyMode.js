/** Max characters of prior story sent back to the model (tail) to control tokens. */
export const STORY_CONTEXT_MAX_CHARS = 14_000;

export const STORY_SEGMENT_MAX_TOKENS = 640;

/** Prepended to the persona system prompt while Story mode runs. */
export const STORY_NARRATOR_SYSTEM = `You are a storyteller for continuous spoken narration. Output plain prose only—no titles, no chapter labels, no bullet lists, no dialogue tags like "he said", and no meta commentary to the listener. Never ask the listener questions or explain that you are an AI. Use vivid sensory detail and natural pacing.`;

export const STORY_CONTINUE_USER =
  "Continue the same narrative from the very next sentence. Write only the next section (several paragraphs). Do not repeat, recap, or summarize earlier events; advance the plot and setting.";

/**
 * @param {string} seed optional user hint (genre, characters, etc.)
 */
export function buildStoryStartUserMessage(seed) {
  const hint = seed?.trim();
  if (hint) {
    return `Begin an original fictional story for spoken narration. The listener asked for this direction (follow it closely): ${hint}\n\nWrite the opening section only—several paragraphs of vivid prose. Narrate only; do not preface or explain.`;
  }
  return `Begin an original fictional story for spoken narration. Invent engaging characters and a clear situation. Write the opening section only—several paragraphs of vivid prose. Narrate only; do not preface or explain.`;
}

/**
 * MiniMax messages for the next story segment.
 * @param {{ role: string, content: string }} systemMessage
 * @param {string} startUserText first user message (frozen for the session)
 * @param {string} storySoFar full concatenated assistant prose so far
 */
export function buildStoryChatMessages(
  systemMessage,
  startUserText,
  storySoFar,
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
    { role: "user", content: STORY_CONTINUE_USER },
  ];
}
