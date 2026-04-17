import { useState, useCallback, useRef, useEffect } from "react";
import Header from "./components/Header";
import ChatContainer from "./components/ChatContainer";
import MessageInput from "./components/MessageInput";
import SettingsModal from "./components/SettingsModal";
import { minimax, ollama } from "./services/api";
import "./App.css";

const STORAGE_KEY = "omnivoice_chat_config";

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return {
    provider: "ollama",
    minimaxApiKey: "",
    minimaxModel: "M2-her",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
  };
}

function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

function App() {
  const [config, setConfig] = useState(loadConfig);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  const updateConfig = useCallback((updates) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...updates };
      saveConfig(newConfig);
      return newConfig;
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isLoading) return;

      const userMessage = {
        id: Date.now(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      const assistantMessageId = Date.now() + 1;
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isLoading: true,
        },
      ]);

      const chatHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        let stream;

        if (config.provider === "minimax") {
          if (!config.minimaxApiKey) {
            throw new Error(
              "MiniMax API key is required. Please configure it in settings.",
            );
          }
          stream = minimax.streamMinimaxResponse(
            chatHistory,
            config.minimaxApiKey,
            config.minimaxModel,
          );
        } else {
          stream = ollama.streamOllamaResponse(
            chatHistory,
            config.ollamaBaseUrl,
            config.ollamaModel,
          );
        }

        for await (const chunk of stream) {
          assistantContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent, isLoading: false }
                : msg,
            ),
          );
        }
      } catch (err) {
        setError(err.message);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `Error: ${err.message}`,
                  isLoading: false,
                  isError: true,
                }
              : msg,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [config, messages, isLoading],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <div className="app">
      <Header
        config={config}
        onProviderChange={(provider) => updateConfig({ provider })}
        onSettingsClick={() => setShowSettings(true)}
        onClearChat={clearChat}
      />
      <div className="app-content">
        <ChatContainer
          messages={messages}
          chatEndRef={chatEndRef}
          error={error}
        />
        <MessageInput onSend={sendMessage} disabled={isLoading} />
      </div>
      {showSettings && (
        <SettingsModal
          config={config}
          onUpdate={updateConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
