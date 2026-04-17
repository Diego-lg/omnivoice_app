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
      if (parsed.error) {
        console.error("[MiniMax] API Error:", parsed.error);
        throw new Error(parsed.error.message || JSON.stringify(parsed.error));
      }
      // Non-streaming response
      const content =
        parsed.choices?.[0]?.message?.content ||
        parsed.choices?.[0]?.text ||
        parsed.choices?.[0]?.delta?.content;
      if (content) {
        console.log("[MiniMax] Yielding non-streaming content");
        yield content;
      }
      return;
    } catch (e) {
      if (e.message.includes("API Error")) throw e;
      console.warn("[MiniMax] Failed to parse JSON:", e.message);
    }
  }

  // Parse SSE stream
  console.log("[MiniMax] Parsing SSE stream");
  const lines = responseText.split(/\r?\n/);
  let previousLength = 0; // Track length of previously yielded content

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

          // OpenAI-style streaming
          if (choice.delta?.content) {
            content = choice.delta.content;
          }

          // MiniMax-specific text format
          if (choice.text) {
            content = choice.text;
          }

          // Base message content field
          if (choice.message?.content) {
            content = choice.message.content;
          }

          if (content && content.trim()) {
            // Only yield NEW delta based on length difference
            // MiniMax sends accumulated content, so only new chars should be yielded
            if (content.length > previousLength) {
              const delta = content.slice(previousLength);
              if (delta) {
                console.log(
                  "[MiniMax] Yielding delta:",
                  delta.substring(0, 50) + (delta.length > 50 ? "..." : ""),
                );
                yield delta;
                // Track by actual yielded delta length, not content.length
                previousLength += delta.length;
              }
            }
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
