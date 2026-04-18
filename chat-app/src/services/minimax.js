const MINIMAX_BASE_URL = "https://api.minimax.io/v1/text/chatcompletion_v2";

export const MINIMAX_MODELS = [
  "M2-her",
  "MiniMax-M2.7",
  "MiniMax-M2.7-highspeed",
  "MiniMax-M2.5",
  "MiniMax-M2.5-highspeed",
];

export async function* streamMinimaxResponse(
  messages,
  apiKey,
  model = "MiniMax-M2.7",
  llmConfig = {},
) {
  console.log("[MiniMax] Starting request with model:", model);
  console.log("[MiniMax] Number of messages:", messages.length);
  console.log("[MiniMax] API URL:", MINIMAX_BASE_URL);

  const requestBody = {
    model: model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    max_tokens: llmConfig.maxTokens || 2048,
    temperature:
      llmConfig.temperature !== undefined ? llmConfig.temperature : 0.8,
    top_p: llmConfig.topP !== undefined ? llmConfig.topP : 0.9,
    presence_penalty:
      llmConfig.presencePenalty !== undefined ? llmConfig.presencePenalty : 0.0,
    frequency_penalty:
      llmConfig.frequencyPenalty !== undefined
        ? llmConfig.frequencyPenalty
        : 0.0,
    repetition_penalty:
      llmConfig.repetitionPenalty !== undefined
        ? llmConfig.repetitionPenalty
        : 1.0,
  };

  let response;
  try {
    console.log("[MiniMax] Sending fetch request...");
    response = await fetch(MINIMAX_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    console.log("[MiniMax] Response status:", response.status);
    console.log("[MiniMax] Response ok:", response.ok);
  } catch (err) {
    console.error("[MiniMax] Fetch error:", err);
    throw err;
  }

  // Read the full response text first to check for errors
  const responseText = await response.text();
  console.log("[MiniMax] Response text length:", responseText.length);
  console.log(
    "[MiniMax] Response text preview:",
    responseText.substring(0, 500),
  );

  if (!response.ok) {
    console.error("[MiniMax] Response not ok, status:", response.status);
    console.error("[MiniMax] Error response:", responseText);
    throw new Error(`HTTP ${response.status}: ${responseText}`);
  }

  // Check if it's an error JSON (not SSE)
  if (responseText.startsWith("{")) {
    console.log(
      "[MiniMax] Response is JSON, not SSE - parsing as non-streaming",
    );
    try {
      const parsed = JSON.parse(responseText);

      // Check for API error
      if (parsed.error) {
        console.error("[MiniMax] API Error:", parsed.error);
        const errorMsg =
          parsed.error.message ||
          parsed.error.error_msg ||
          JSON.stringify(parsed.error);
        throw new Error(`MiniMax API Error: ${errorMsg}`);
      }

      // Check for usage exceeded or other error codes
      if (parsed.error_code) {
        console.error(
          "[MiniMax] API Error Code:",
          parsed.error_code,
          parsed.error_msg,
        );
        throw new Error(
          `MiniMax API Error ${parsed.error_code}: ${parsed.error_msg || "Unknown error"}`,
        );
      }

      // Non-streaming response - extract content with correct priority
      // MiniMax non-streaming returns: choices[0].message.content
      const choice = parsed.choices?.[0];
      let content = null;

      if (choice) {
        // Priority 1: message.content (standard non-streaming response)
        if (choice.message?.content) {
          content = choice.message.content;
        }
        // Priority 2: text (MiniMax-specific format)
        else if (choice.text) {
          content = choice.text;
        }
        // Priority 3: delta.content (less common for non-streaming but handle it)
        else if (choice.delta?.content) {
          content = choice.delta.content;
        }
      }

      if (content) {
        console.log(
          "[MiniMax] Yielding non-streaming content, length:",
          content.length,
        );
        yield content;
      } else {
        // No content found - this might be an unexpected response format
        console.warn("[MiniMax] No content found in non-streaming response");
        console.warn(
          "[MiniMax] Response structure:",
          JSON.stringify(parsed).substring(0, 500),
        );
      }
      return;
    } catch (e) {
      if (e.message.includes("API Error")) throw e;
      if (e.message.includes("Error Code")) throw e;
      console.warn("[MiniMax] Failed to parse JSON response:", e.message);
      throw new Error(`Failed to parse MiniMax response: ${e.message}`);
    }
  }

  // Parse SSE stream
  console.log("[MiniMax] Parsing SSE stream");
  const lines = responseText.split(/\r?\n/);

  // Track the full accumulated text we've already yielded
  // This handles MiniMax sending accumulated text in each chunk
  let accumulatedYieldedText = "";

  for (const line of lines) {
    if (line.trim() === "") continue;

    let data = line;
    if (data.startsWith("data: ")) {
      data = data.slice(6);
    }

    if (data === "[DONE]") {
      console.log("[MiniMax] Received [DONE]");
      return;
    }

    try {
      const parsed = JSON.parse(data);
      console.log("[MiniMax] Parsed chunk, keys:", Object.keys(parsed));

      // Process ALL choices in the chunk, not just the first one
      if (parsed.choices && parsed.choices.length > 0) {
        for (const choice of parsed.choices) {
          let content = null;

          // OpenAI-style streaming (priority - most common format)
          if (choice.delta?.content) {
            content = choice.delta.content;
          }

          // MiniMax-specific text format (only if delta.content not set)
          else if (choice.text) {
            content = choice.text;
          }

          // Base message content field (only if neither above is set)
          else if (choice.message?.content) {
            content = choice.message.content;
          }

          if (content) {
            // Normalize content - trim leading/trailing whitespace for comparison
            const normalizedContent = content.trim();

            // Check if this chunk is identical to what we've already yielded (deduplication)
            // This handles the case where API sends the same content multiple times
            if (accumulatedYieldedText.includes(normalizedContent)) {
              console.log(
                "[MiniMax] Skipping chunk - content already yielded:",
                normalizedContent.substring(0, 30),
              );
              continue;
            }

            // Check if this chunk starts with our accumulated text
            // If it does, extract only the new portion
            if (
              accumulatedYieldedText.length > 0 &&
              (content.startsWith(accumulatedYieldedText) ||
                normalizedContent.startsWith(accumulatedYieldedText.trim()))
            ) {
              // Extract the new portion after what we've already seen
              const existingLen = accumulatedYieldedText.length;
              const newContent = content.slice(existingLen);

              if (newContent && newContent.trim()) {
                console.log(
                  "[MiniMax] Yielding new content (after accumulated):",
                  newContent.substring(0, 50) +
                    (newContent.length > 50 ? "..." : ""),
                );
                yield newContent;
                accumulatedYieldedText += newContent;
              } else if (newContent.length > 0) {
                // Whitespace-only new content - still track it to stay in sync
                accumulatedYieldedText += newContent;
              }
            } else if (content.length > accumulatedYieldedText.length) {
              // Content doesn't start with accumulated text - either first chunk or mismatch
              // Try to extract new content based on length comparison
              const existingLength = accumulatedYieldedText.length;
              const contentLength = content.length;

              if (contentLength > existingLength) {
                const newContent = content.slice(existingLength);

                if (newContent && newContent.trim()) {
                  // Additional safety: check if newContent is essentially duplicate
                  // If accumulated already ends with newContent, skip it
                  if (accumulatedYieldedText.endsWith(newContent.trim())) {
                    console.log(
                      "[MiniMax] Skipping - appears to be duplicate suffix:",
                      newContent.substring(0, 30),
                    );
                    continue;
                  }

                  console.log(
                    "[MiniMax] Yielding new content (by length):",
                    newContent.substring(0, 50) +
                      (newContent.length > 50 ? "..." : ""),
                  );
                  yield newContent;
                  accumulatedYieldedText += newContent;
                } else if (newContent.length > 0) {
                  // Whitespace-only new content - still track it to stay in sync
                  accumulatedYieldedText += newContent;
                }
              }
            }
            // If content length <= accumulated length, skip (already fully yielded)
          }
        }
      }
    } catch (e) {
      console.warn(
        "[MiniMax] Failed to parse line:",
        line.substring(0, 100),
        "Error:",
        e.message,
      );
    }
  }

  console.log("[MiniMax] Stream ended");
}
