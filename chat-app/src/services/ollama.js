const OLLAMA_DEFAULT_URL = "http://localhost:11434";

export async function* streamOllamaResponse(
  messages,
  baseUrl = OLLAMA_DEFAULT_URL,
  model = "llama3.2",
) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama connection failed (HTTP ${response.status}). Make sure Ollama is running.`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const lastYieldedContent = new Set(); // Track last yielded content to avoid duplicates

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content;
          if (content && content.trim()) {
            // Skip if we already yielded this exact content to avoid duplicates
            if (lastYieldedContent.has(content)) {
              console.log("[Ollama] Skipping duplicate content");
              continue;
            }
            lastYieldedContent.add(content);
            // Limit size of tracking set to prevent memory issues
            if (lastYieldedContent.size > 1000) {
              const firstKey = lastYieldedContent.values().next().value;
              lastYieldedContent.delete(firstKey);
            }
            yield content;
          }
          if (parsed.done) {
            return;
          }
        } catch (e) {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function fetchOllamaModels(baseUrl = OLLAMA_DEFAULT_URL) {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m) => m.name) || [];
  } catch {
    return [];
  }
}
