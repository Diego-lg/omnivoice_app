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

  // Parse SSE stream - collect all content from every chunk then yield once
  console.log("[MiniMax] Parsing SSE stream");
  const lines = responseText.split(/\r?\n/);

  // MiniMax choice.text is cumulative; track the last seen value to get the full text
  let lastChoiceText = "";
  // delta.content chunks are incremental; accumulate them
  let deltaContent = "";

  for (const line of lines) {
    if (line.trim() === "") continue;

    let data = line;
    if (data.startsWith("data: ")) {
      data = data.slice(6);
    }

    if (data === "[DONE]") break;

    try {
      const parsed = JSON.parse(data);

      if (parsed.choices && parsed.choices.length > 0) {
        for (const choice of parsed.choices) {
          if (choice.delta?.content) {
            deltaContent += choice.delta.content;
          } else if (choice.text) {
            lastChoiceText = choice.text;
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

  // Prefer the cumulative choice.text (most complete), fall back to accumulated delta
  const fullContent = lastChoiceText || deltaContent;
  if (fullContent) {
    console.log("[MiniMax] Yielding full response, length:", fullContent.length);
    yield fullContent;
  } else {
    console.warn("[MiniMax] No content found in SSE stream");
  }

  console.log("[MiniMax] Stream ended");
}
