import { useState, useCallback, useRef, useEffect } from "react";
import Header from "./components/Header";
import ChatContainer from "./components/ChatContainer";
import MessageInput from "./components/MessageInput";
import SearchOverlay from "./components/SearchOverlay";
import SettingsModal from "./components/SettingsModal";
import PersonaEditor from "./components/PersonaEditor";
import ChatHistory from "./components/ChatHistory";
import { minimax, omnivoice, getOmnivoiceBaseUrl } from "./services/api";
import { stripEmojis, prepareTextForTts } from "./utils/text";
import { getDirectorModeSystemAppendix } from "./utils/directorMode";
import { PREMADE_PERSONAS, DEFAULT_PERSONA_ID } from "./data/personas";
import "./App.css";

const CONFIG_STORAGE_KEY = "omnivoice_chat_config";
const SESSIONS_STORAGE_KEY = "omnivoice_chat_sessions";
const CURRENT_SESSION_KEY = "omnivoice_chat_current_session";
const PERSONAS_STORAGE_KEY = "omnivoice_chat_personas";
const SELECTED_PERSONA_KEY = "omnivoice_chat_selected_persona";

const DEFAULT_CONFIG = {
  provider: "minimax",
  minimaxApiKey: import.meta.env.VITE_MINIMAX_API_KEY || "",
  minimaxModel: "M2-her",
  voiceEnabled: false,
  voiceMode: "auto",
  voiceConfig: {},
  voiceGenerationConfig: {
    language: null,
    speed: 1.0,
    numStep: 48,
    guidanceScale: 2.25,
  },
  sttConfig: {
    language: "en-US",
    continuous: false,
  },
  playbackConfig: {
    autoPlay: false,
    defaultVolume: 1.0,
    defaultSpeed: 1.0,
  },
  /** When on, TTS is enabled and replies use speech-to-speech when you send a mic clip. */
  realtimeSpeechToSpeech: false,
  /** OmniVoice HTTP root (e.g. http://192.168.1.10:8005). Empty = same origin / Vite proxy. */
  omnivoiceBaseUrl: import.meta.env.VITE_OMNIVOICE_API_URL || "",
  textFormatConfig: {
    fontSize: "medium",
    fontFamily: "system",
    codeStyle: "dark",
    markdown: true,
    /** When voice is on, steer LLM tone for spoken output */
    directorMode: false,
    directorMood: "neutral",
    directorMoodCustom: "",
  },
  llmConfig: {
    maxTokens: 2048,
    temperature: 0.8,
    topP: 0.9,
    presencePenalty: 0.0,
    frequencyPenalty: 0.0,
    repetitionPenalty: 1.0,
  },
};

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // If saved config has empty minimaxApiKey but env has one, use env value
      if (!parsed.minimaxApiKey && import.meta.env.VITE_MINIMAX_API_KEY) {
        parsed.minimaxApiKey = import.meta.env.VITE_MINIMAX_API_KEY;
      }
      return parsed;
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

function loadSessions() {
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [];
}

function saveSessions(sessions) {
  try {
    // Strip ephemeral audio data before serializing — Blobs and blob URLs
    // don't survive JSON round-trips or page reloads.
    const serializable = sessions.map((s) => ({
      ...s,
      messages: s.messages.map(({ audioBlob, audioUrl, isStreamingAudio, ...msg }) => msg),
    }));
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(serializable));
  } catch {}
}

function loadCurrentSessionId() {
  try {
    const saved = localStorage.getItem(CURRENT_SESSION_KEY);
    if (saved) {
      return saved;
    }
  } catch {}
  return null;
}

function saveCurrentSessionId(sessionId) {
  try {
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
  } catch {}
}

function createNewSession(title = null) {
  const now = new Date();
  return {
    id: `session-${Date.now()}`,
    title: title || "New Conversation",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    messages: [],
    personaId: DEFAULT_PERSONA_ID,
  };
}

function getDefaultSession() {
  const session = createNewSession("Main Chat");
  session.id = "main";
  return session;
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

function getAllPersonas(customPersonas) {
  return [...PREMADE_PERSONAS, ...customPersonas];
}

function getPersonaById(personas, id) {
  return (
    personas.find((p) => p.id === id) ||
    personas.find((p) => p.id === DEFAULT_PERSONA_ID)
  );
}

function generateSessionTitle(messages) {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    const content = firstUserMsg.content.trim();
    if (content.length > 30) {
      return content.substring(0, 30) + "...";
    }
    return content;
  }
  return "New Conversation";
}

function App() {
  const [config, setConfig] = useState(loadConfig);
  const [sessions, setSessions] = useState(() => {
    const saved = loadSessions();
    if (saved.length === 0) {
      return [getDefaultSession()];
    }
    return saved;
  });
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    const saved = loadCurrentSessionId();
    const loadedSessions = loadSessions();
    if (saved && loadedSessions.find((s) => s.id === saved)) {
      return saved;
    }
    return loadedSessions[0]?.id || "main";
  });
  const [customPersonas, setCustomPersonas] = useState(loadPersonas);
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    loadSelectedPersonaId,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scrollToIndex, setScrollToIndex] = useState(null);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);
  // Shared AudioContext created during a user gesture so the browser allows
  // audio playback even when TTS is triggered asynchronously later.
  const sharedAudioContextRef = useRef(null);

  const allPersonas = getAllPersonas(customPersonas);
  const currentPersona = getPersonaById(allPersonas, selectedPersonaId);
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveCurrentSessionId(currentSessionId);
  }, [currentSessionId]);

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

  const handleRealtimeStsToggle = useCallback(() => {
    const next = !config.realtimeSpeechToSpeech;
    updateConfig({
      realtimeSpeechToSpeech: next,
      ...(next ? { voiceEnabled: true } : {}),
    });
  }, [config.realtimeSpeechToSpeech, updateConfig]);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNewChat = useCallback(() => {
    const newSession = createNewSession();
    setSessions((prev) => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    setShowHistory(false);
    setError(null);
  }, []);

  const handleSelectSession = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    setShowHistory(false);
    setError(null);
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId) => {
      if (sessions.length <= 1) {
        return;
      }
      const newSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(newSessions);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(newSessions[0].id);
      }
    },
    [sessions, currentSessionId],
  );

  const handleRenameSession = useCallback((sessionId, newTitle) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)),
    );
  }, []);

  const handleExportSession = useCallback(
    (sessionId = null) => {
      const sessionToExport = sessionId
        ? sessions.find((s) => s.id === sessionId)
        : null;

      if (sessionToExport) {
        const data = JSON.stringify(sessionToExport, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sessionToExport.title.replace(/[^a-z0-9]/gi, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = JSON.stringify(sessions, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `omnivoice_chats_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [sessions],
  );

  const handlePersonaChange = useCallback(
    (personaId) => {
      setSelectedPersonaId(personaId);
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, personaId } : s)),
      );
    },
    [currentSessionId],
  );

  const handlePersonaSave = useCallback((savedPersonas) => {
    setCustomPersonas(savedPersonas);
  }, []);

  const sendMessage = useCallback(
    async (content, images = [], voiceBlob = null) => {
      if ((!content.trim() && images.length === 0 && !voiceBlob) || isLoading)
        return;

      const trimmed = content.trim();
      const omnivoiceApiRoot = getOmnivoiceBaseUrl(config);
      let llmUserText = trimmed;
      const needsServerTranscription =
        voiceBlob &&
        (!llmUserText || llmUserText === "(Voice message)");

      /** When server ASR fails, still attach audio and call the LLM with an explicit instruction. */
      let voiceTranscriptionFallback = false;

      if (needsServerTranscription) {
        try {
          llmUserText = (
            await omnivoice.transcribeVoiceBlob(voiceBlob, omnivoiceApiRoot)
          ).trim();
        } catch (err) {
          console.warn("Voice transcription failed:", err);
          voiceTranscriptionFallback = true;
          llmUserText =
            "The user sent a spoken voice message. Automatic transcription was unavailable, so you do not have a verbatim transcript. Respond helpfully and concisely.";
        }
        if (!llmUserText.trim()) {
          voiceTranscriptionFallback = true;
          llmUserText =
            "The user sent a spoken voice message. Automatic transcription returned empty text. Respond helpfully and concisely.";
        }
      }

      const userDisplayContent =
        voiceTranscriptionFallback &&
        (!trimmed || trimmed === "(Voice message)")
          ? "Voice message"
          : llmUserText;

      // Create or reuse a shared AudioContext while we're inside a user gesture.
      // Browsers require a gesture to allow audio playback; creating the context
      // here (before any async work) ensures it starts in "running" state.
      if (config.voiceEnabled || config.realtimeSpeechToSpeech) {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (
            !sharedAudioContextRef.current ||
            sharedAudioContextRef.current.state === "closed"
          ) {
            sharedAudioContextRef.current = new AudioCtx();
          }
          if (sharedAudioContextRef.current.state === "suspended") {
            sharedAudioContextRef.current.resume().catch(() => {});
          }
        } catch {
          // AudioContext not available (e.g. server-side render)
        }
      }

      const userMessage = {
        id: Date.now(),
        role: "user",
        content: userDisplayContent,
        images: images,
        timestamp: new Date().toISOString(),
        audioBlob: voiceBlob || null,
      };

      setSessions((prev) => {
        return prev.map((s) => {
          if (s.id !== currentSessionId) return s;
          const updatedMessages = [...s.messages, userMessage];
          return {
            ...s,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
            title:
              s.title === "New Conversation" && updatedMessages.length === 1
                ? generateSessionTitle(updatedMessages)
                : s.title,
          };
        });
      });

      setIsLoading(true);
      setError(null);

      const assistantMessageId = Date.now() + 1;
      let assistantContent = "";

      setSessions((prev) => {
        return prev.map((s) => {
          if (s.id !== currentSessionId) return s;
          return {
            ...s,
            messages: [
              ...s.messages,
              {
                id: assistantMessageId,
                role: "assistant",
                content: "",
                timestamp: new Date().toISOString(),
                isLoading: true,
                isStreaming: true,
              },
            ],
          };
        });
      });

      const voiceEnabledForLlm =
        config.voiceEnabled || config.realtimeSpeechToSpeech;
      const directorAppendix = voiceEnabledForLlm
        ? getDirectorModeSystemAppendix(config.textFormatConfig)
        : null;
      const systemMessage = {
        role: "system",
        content: [currentPersona.systemPrompt, directorAppendix]
          .filter(Boolean)
          .join("\n\n"),
      };

      const chatHistory = [
        systemMessage,
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: llmUserText },
      ];

      try {
        let stream;
        const voiceEnabled =
          config.voiceEnabled || config.realtimeSpeechToSpeech;

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
            config.llmConfig,
          );
        } else {
          throw new Error("Invalid provider configured.");
        }

        for await (const chunk of stream) {
          assistantContent += stripEmojis(chunk);
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== currentSessionId) return s;
              return {
                ...s,
                messages: s.messages.map((msg) =>
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
            }),
          );
        }

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== currentSessionId) return s;
            return {
              ...s,
              messages: s.messages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, isStreaming: false }
                  : msg,
              ),
            };
          }),
        );

        // Capture identifiers before any async gap so closures are stable.
        const ttsSessionId = currentSessionId;
        const ttsMsgId = assistantMessageId;
        const ttsContent =
          prepareTextForTts(assistantContent).trim() ||
          stripEmojis(assistantContent).replace(/\s+/g, " ").trim();

        if (voiceEnabled && ttsContent) {
          const ttsOptions = {
            voice: config.voiceMode || "auto",
            voiceConfig: config.voiceConfig || {},
            generationConfig: config.voiceGenerationConfig || {},
            voiceProfileId: config.voiceConfig?.selectedProfileId || null,
            audioContext: sharedAudioContextRef.current || null,
          };

          // Mark the message as streaming audio so the UI shows a playing indicator.
          // Text remains visible — we no longer hide it while waiting for audio.
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== ttsSessionId) return s;
              return {
                ...s,
                messages: s.messages.map((msg) =>
                  msg.id === ttsMsgId
                    ? { ...msg, isStreamingAudio: true }
                    : msg,
                ),
              };
            }),
          );

          const attachAudio = (audioBlob, audioUrl, extra = {}) => {
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== ttsSessionId) return s;
                return {
                  ...s,
                  messages: s.messages.map((msg) =>
                    msg.id === ttsMsgId
                      ? {
                          ...msg,
                          audioBlob,
                          audioUrl,
                          isStreamingAudio: false,
                          ...extra,
                        }
                      : msg,
                  ),
                };
              }),
            );
          };

          const clearStreamingAudio = () => {
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== ttsSessionId) return s;
                return {
                  ...s,
                  messages: s.messages.map((msg) =>
                    msg.id === ttsMsgId
                      ? { ...msg, isStreamingAudio: false }
                      : msg,
                  ),
                };
              }),
            );
          };

          if (voiceBlob) {
            omnivoice
              .speechToSpeech(
                voiceBlob,
                ttsContent,
                ttsOptions,
                omnivoiceApiRoot,
              )
              .then((audioResult) => {
                attachAudio(audioResult.audioBlob, audioResult.audioUrl, {
                  transcript: audioResult.transcript,
                });
              })
              .catch((stsErr) => {
                console.warn(
                  "Speech-to-speech failed, falling back to streaming TTS:",
                  stsErr,
                );
                omnivoice
                  .streamTextToSpeech(
                    ttsContent,
                    ttsOptions,
                    omnivoiceApiRoot,
                  )
                  .then(({ audioBlob, audioUrl }) =>
                    attachAudio(audioBlob, audioUrl),
                  )
                  .catch((err) => {
                    console.error("Fallback streaming TTS failed:", err);
                    clearStreamingAudio();
                  });
              });
          } else {
            omnivoice
              .streamTextToSpeech(
                ttsContent,
                ttsOptions,
                omnivoiceApiRoot,
              )
              .then(({ audioBlob, audioUrl }) =>
                attachAudio(audioBlob, audioUrl),
              )
              .catch((err) => {
                console.error("Streaming TTS failed:", err);
                clearStreamingAudio();
              });
          }
        }
      } catch (err) {
        setError(err.message);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== currentSessionId) return s;
            return {
              ...s,
              messages: s.messages.map((msg) =>
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
          }),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [config, currentSessionId, messages, isLoading, currentPersona],
  );

  const clearChat = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentSessionId) return s;
        return {
          ...s,
          messages: [],
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    setError(null);
  }, [currentSessionId]);

  const handleSearchNavigate = useCallback((index) => {
    setScrollToIndex(index);
    setTimeout(() => setScrollToIndex(null), 100);
  }, []);

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );

  return (
    <div className={`app ${showHistory ? "history-open" : ""}`}>
      <ChatHistory
        sessions={sortedSessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onExportSession={handleExportSession}
        onToggleHistory={() => setShowHistory(!showHistory)}
        isOpen={showHistory}
      />
      <Header
        config={config}
        sessions={sessions}
        currentSessionName={currentSession?.title || "New Chat"}
        personas={allPersonas}
        selectedPersonaId={selectedPersonaId}
        onProviderChange={(provider) => updateConfig({ provider })}
        onPersonaChange={handlePersonaChange}
        onEditPersonas={() => setShowPersonaEditor(true)}
        onSettingsClick={() => setShowSettings(true)}
        onClearChat={clearChat}
        onSearchClick={() => setShowSearch(true)}
        onHistoryClick={() => setShowHistory(true)}
      />
      <div className="app-content">
        <ChatContainer
          messages={messages}
          chatEndRef={chatEndRef}
          error={error}
          scrollToIndex={scrollToIndex}
          textFormatConfig={config.textFormatConfig}
        />
        <MessageInput
          onSend={sendMessage}
          disabled={isLoading}
          sttConfig={config.sttConfig}
          realtimeStsEnabled={!!config.realtimeSpeechToSpeech}
          onRealtimeStsToggle={handleRealtimeStsToggle}
        />
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
