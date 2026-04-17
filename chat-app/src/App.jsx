import { useState, useCallback, useRef, useEffect } from "react";
import Header from "./components/Header";
import ChatContainer from "./components/ChatContainer";
import MessageInput from "./components/MessageInput";
import SearchOverlay from "./components/SearchOverlay";
import SettingsModal from "./components/SettingsModal";
import PersonaEditor from "./components/PersonaEditor";
import { minimax, ollama, omnivoice } from "./services/api";
import { PREMADE_PERSONAS, DEFAULT_PERSONA_ID } from "./data/personas";
import "./App.css";

const CONFIG_STORAGE_KEY = "omnivoice_chat_config";
const BRANCHES_STORAGE_KEY = "omnivoice_chat_branches";
const PERSONAS_STORAGE_KEY = "omnivoice_chat_personas";
const SELECTED_PERSONA_KEY = "omnivoice_chat_selected_persona";

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
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
    voiceEnabled: false,
    voiceMode: "auto",
    voiceConfig: {},
    voiceGenerationConfig: {
      language: null,
      speed: 1.0,
      numStep: 32,
    },
  };
}

function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

function loadBranches() {
  try {
    const saved = localStorage.getItem(BRANCHES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return null;
}

function saveBranches(branches) {
  try {
    localStorage.setItem(BRANCHES_STORAGE_KEY, JSON.stringify(branches));
  } catch {}
}

function loadPersonas() {
  try {
    const saved = localStorage.getItem(PERSONAS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [];
}

function savePersonas(personas) {
  try {
    localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(personas));
  } catch {}
}

function loadSelectedPersonaId() {
  try {
    const saved = localStorage.getItem(SELECTED_PERSONA_KEY);
    if (saved) {
      return saved;
    }
  } catch {}
  return DEFAULT_PERSONA_ID;
}

function saveSelectedPersonaId(personaId) {
  try {
    localStorage.setItem(SELECTED_PERSONA_KEY, personaId);
  } catch {}
}

function createInitialBranch() {
  return {
    id: "main",
    name: "Main",
    parentBranchId: null,
    rootMessageId: null,
    messages: [],
  };
}

function getAllPersonas(customPersonas) {
  return [...PREMADE_PERSONAS, ...customPersonas];
}

function getPersonaById(personas, id) {
  return (
    personas.find((p) => p.id === id) ||
    personas.find((p) => p.id === DEFAULT_PERSONA_ID)
  );
}

function App() {
  const [config, setConfig] = useState(loadConfig);
  const [branches, setBranches] = useState(() => {
    const saved = loadBranches();
    return (
      saved || { branches: [createInitialBranch()], currentBranchId: "main" }
    );
  });
  const [customPersonas, setCustomPersonas] = useState(loadPersonas);
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    loadSelectedPersonaId,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [scrollToIndex, setScrollToIndex] = useState(null);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  const allPersonas = getAllPersonas(customPersonas);
  const currentPersona = getPersonaById(allPersonas, selectedPersonaId);

  useEffect(() => {
    saveBranches(branches);
  }, [branches]);

  useEffect(() => {
    savePersonas(customPersonas);
  }, [customPersonas]);

  useEffect(() => {
    saveSelectedPersonaId(selectedPersonaId);
  }, [selectedPersonaId]);

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
  }, [
    branches.branches.find((b) => b.id === branches.currentBranchId)?.messages,
    scrollToBottom,
  ]);

  const createBranch = useCallback(
    (fromMessageId) => {
      const newBranchId = `branch-${Date.now()}`;
      const currentBranchIndex = branches.branches.findIndex(
        (b) => b.id === branches.currentBranchId,
      );
      const currentBranch = branches.branches[currentBranchIndex];

      const messageIndex = currentBranch.messages.findIndex(
        (m) => m.id === fromMessageId,
      );
      const branchMessages = currentBranch.messages.slice(0, messageIndex + 1);

      const branchCount =
        branches.branches.filter((b) => b.id.startsWith("branch-")).length + 1;

      const newBranch = {
        id: newBranchId,
        name: `Branch ${branchCount}`,
        parentBranchId: branches.currentBranchId,
        rootMessageId: fromMessageId,
        messages: branchMessages,
      };

      setBranches((prev) => ({
        branches: [...prev.branches, newBranch],
        currentBranchId: newBranchId,
      }));
    },
    [branches],
  );

  const switchBranch = useCallback((branchId) => {
    setBranches((prev) => ({
      ...prev,
      currentBranchId: branchId,
    }));
    setShowBranchSelector(false);
  }, []);

  const handlePersonaChange = useCallback((personaId) => {
    setSelectedPersonaId(personaId);
  }, []);

  const handlePersonaSave = useCallback((savedPersonas) => {
    setCustomPersonas(savedPersonas);
  }, []);

  const sendMessage = useCallback(
    async (content, images = []) => {
      if ((!content.trim() && images.length === 0) || isLoading) return;

      const userMessage = {
        id: Date.now(),
        role: "user",
        content: content.trim(),
        images: images,
        timestamp: new Date(),
      };

      const currentBranchIndex = branches.branches.findIndex(
        (b) => b.id === branches.currentBranchId,
      );

      setBranches((prev) => {
        const newBranches = [...prev.branches];
        newBranches[currentBranchIndex] = {
          ...newBranches[currentBranchIndex],
          messages: [...newBranches[currentBranchIndex].messages, userMessage],
        };
        return { ...prev, branches: newBranches };
      });

      setIsLoading(true);
      setError(null);

      const assistantMessageId = Date.now() + 1;
      let assistantContent = "";

      setBranches((prev) => {
        const newBranches = [...prev.branches];
        newBranches[currentBranchIndex] = {
          ...newBranches[currentBranchIndex],
          messages: [
            ...newBranches[currentBranchIndex].messages,
            {
              id: assistantMessageId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              isLoading: true,
              isStreaming: true,
            },
          ],
        };
        return { ...prev, branches: newBranches };
      });

      // Build chat history with system prompt
      const systemMessage = {
        role: "system",
        content: currentPersona.systemPrompt,
      };

      const currentMessages =
        branches.branches.find((b) => b.id === branches.currentBranchId)
          ?.messages || [];
      const chatHistory = [
        systemMessage,
        ...currentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: content.trim() },
      ];

      try {
        let stream;
        let voiceEnabled = config.voiceEnabled;

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
          // Ollama (default)
          stream = ollama.streamOllamaResponse(
            chatHistory,
            config.ollamaBaseUrl,
            config.ollamaModel,
          );
        }

        for await (const chunk of stream) {
          assistantContent += chunk;
          setBranches((prev) => {
            const newBranches = [...prev.branches];
            const idx = newBranches.findIndex(
              (b) => b.id === branches.currentBranchId,
            );
            newBranches[idx] = {
              ...newBranches[idx],
              messages: newBranches[idx].messages.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: assistantContent,
                      isLoading: false,
                      isStreaming: true,
                    }
                  : msg,
              ),
            };
            return { ...prev, branches: newBranches };
          });
        }

        // Streaming complete - set isStreaming to false
        setBranches((prev) => {
          const newBranches = [...prev.branches];
          const idx = newBranches.findIndex(
            (b) => b.id === branches.currentBranchId,
          );
          newBranches[idx] = {
            ...newBranches[idx],
            messages: newBranches[idx].messages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg,
            ),
          };
          return { ...prev, branches: newBranches };
        });

        // If voice is enabled, generate TTS audio for the response
        if (voiceEnabled && assistantContent.trim()) {
          setBranches((prev) => {
            const newBranches = [...prev.branches];
            const idx = newBranches.findIndex(
              (b) => b.id === branches.currentBranchId,
            );
            newBranches[idx] = {
              ...newBranches[idx],
              messages: newBranches[idx].messages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, isLoading: true }
                  : msg,
              ),
            };
            return { ...prev, branches: newBranches };
          });

          try {
            const ttsOptions = {
              voice: config.voiceMode || "auto",
              voiceConfig: config.voiceConfig || {},
              generationConfig: config.voiceGenerationConfig || {},
            };
            const { audioBlob, audioUrl } = await omnivoice.textToSpeech(
              assistantContent,
              ttsOptions,
            );

            setBranches((prev) => {
              const newBranches = [...prev.branches];
              const idx = newBranches.findIndex(
                (b) => b.id === branches.currentBranchId,
              );
              newBranches[idx] = {
                ...newBranches[idx],
                messages: newBranches[idx].messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, audioBlob, audioUrl, isLoading: false }
                    : msg,
                ),
              };
              return { ...prev, branches: newBranches };
            });
          } catch (ttsErr) {
            // If TTS fails, just show text without audio
            console.error("TTS generation failed:", ttsErr);
            setBranches((prev) => {
              const newBranches = [...prev.branches];
              const idx = newBranches.findIndex(
                (b) => b.id === branches.currentBranchId,
              );
              newBranches[idx] = {
                ...newBranches[idx],
                messages: newBranches[idx].messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, isLoading: false }
                    : msg,
                ),
              };
              return { ...prev, branches: newBranches };
            });
          }
        }
      } catch (err) {
        setError(err.message);
        setBranches((prev) => {
          const newBranches = [...prev.branches];
          const idx = newBranches.findIndex(
            (b) => b.id === branches.currentBranchId,
          );
          newBranches[idx] = {
            ...newBranches[idx],
            messages: newBranches[idx].messages.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: `Error: ${err.message}`,
                    isLoading: false,
                    isStreaming: false,
                    isError: true,
                  }
                : msg,
            ),
          };
          return { ...prev, branches: newBranches };
        });
      } finally {
        setIsLoading(false);
      }
    },
    [config, branches, isLoading, currentPersona],
  );

  const clearChat = useCallback(() => {
    setBranches((prev) => {
      const newBranches = [...prev.branches];
      const idx = newBranches.findIndex((b) => b.id === prev.currentBranchId);
      newBranches[idx] = {
        ...newBranches[idx],
        messages: [],
      };
      return { ...prev, branches: newBranches };
    });
    setError(null);
  }, []);

  const handleSearchNavigate = useCallback((index) => {
    setScrollToIndex(index);
    setTimeout(() => setScrollToIndex(null), 100);
  }, []);

  const [showBranchSelector, setShowBranchSelector] = useState(false);

  const currentBranch =
    branches.branches.find((b) => b.id === branches.currentBranchId) ||
    branches.branches[0];
  const messages = currentBranch?.messages || [];

  return (
    <div className="app">
      <Header
        config={config}
        branches={branches}
        currentBranchName={currentBranch?.name || "Main"}
        personas={allPersonas}
        selectedPersonaId={selectedPersonaId}
        onProviderChange={(provider) => updateConfig({ provider })}
        onPersonaChange={handlePersonaChange}
        onEditPersonas={() => setShowPersonaEditor(true)}
        onSettingsClick={() => setShowSettings(true)}
        onClearChat={clearChat}
        onSearchClick={() => setShowSearch(true)}
        onBranchSwitch={switchBranch}
        onBranchCreate={createBranch}
        showBranchSelector={showBranchSelector}
        onToggleBranchSelector={() =>
          setShowBranchSelector(!showBranchSelector)
        }
      />
      <div className="app-content">
        <ChatContainer
          messages={messages}
          chatEndRef={chatEndRef}
          error={error}
          scrollToIndex={scrollToIndex}
          onBranchClick={createBranch}
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
      {showPersonaEditor && (
        <PersonaEditor
          personas={customPersonas}
          selectedPersonaId={selectedPersonaId}
          onPersonaChange={handlePersonaChange}
          onSave={handlePersonaSave}
          onClose={() => setShowPersonaEditor(false)}
        />
      )}
      {showSearch && (
        <SearchOverlay
          messages={messages}
          onClose={() => setShowSearch(false)}
          onNavigate={handleSearchNavigate}
        />
      )}
    </div>
  );
}

export default App;
