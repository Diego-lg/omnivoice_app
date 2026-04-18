import { useState, useEffect, useRef } from "react";
import { omnivoice, VOICE_MODES } from "../services/api";
import "./VoiceSettings.css";

const LANGUAGES = [
  { id: null, name: "Auto-detect" },
  { id: "en", name: "English" },
  { id: "zh", name: "Chinese" },
  { id: "ja", name: "Japanese" },
  { id: "ko", name: "Korean" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "it", name: "Italian" },
  { id: "pt", name: "Portuguese" },
  { id: "ru", name: "Russian" },
  { id: "ar", name: "Arabic" },
  { id: "hi", name: "Hindi" },
];

const STT_LANGUAGES = [
  { id: "en-US", name: "English (US)" },
  { id: "en-GB", name: "English (UK)" },
  { id: "zh-CN", name: "Chinese (Simplified)" },
  { id: "zh-TW", name: "Chinese (Traditional)" },
  { id: "ja-JP", name: "Japanese" },
  { id: "ko-KR", name: "Korean" },
  { id: "es-ES", name: "Spanish" },
  { id: "es-MX", name: "Spanish (Mexico)" },
  { id: "fr-FR", name: "French" },
  { id: "de-DE", name: "German" },
  { id: "it-IT", name: "Italian" },
  { id: "pt-BR", name: "Portuguese (Brazil)" },
  { id: "ru-RU", name: "Russian" },
  { id: "ar-SA", name: "Arabic" },
  { id: "hi-IN", name: "Hindi" },
];

function VoiceSettings({ config, onUpdate }) {
  const [voiceProfiles, setVoiceProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [refAudioFile, setRefAudioFile] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [checkingServer, setCheckingServer] = useState(false);
  const fileInputRef = useRef(null);

  const voiceEnabled = config.voiceEnabled || false;
  const voiceMode = config.voiceMode || "auto";
  const generationConfig = config.voiceGenerationConfig || {
    language: null,
    speed: 1.0,
    numStep: 48,
    guidanceScale: 2.25,
  };
  const sttConfig = config.sttConfig || {
    language: "en-US",
    continuous: false,
  };
  const playbackConfig = config.playbackConfig || {
    autoPlay: false,
    defaultVolume: 1.0,
    defaultSpeed: 1.0,
  };

  useEffect(() => {
    loadVoiceProfiles();
    checkServerHealth();
  }, []);

  const handleVoiceEnabledChange = (enabled) => {
    onUpdate({ voiceEnabled: enabled });
  };

  const loadVoiceProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const profiles = await omnivoice.getVoiceProfiles();
      setVoiceProfiles(profiles);
    } catch (err) {
      console.error("Failed to load voice profiles:", err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const checkServerHealth = async () => {
    setCheckingServer(true);
    try {
      const status = await omnivoice.checkHealth();
      setServerStatus(status);
    } catch (err) {
      setServerStatus({ error: err.message });
    } finally {
      setCheckingServer(false);
    }
  };

  const handleVoiceModeChange = (mode) => {
    onUpdate({ voiceMode: mode });
  };

  const handleGenerationConfigChange = (field, value) => {
    onUpdate({
      voiceGenerationConfig: {
        ...generationConfig,
        [field]: value,
      },
    });
  };

  const handleSttConfigChange = (field, value) => {
    onUpdate({
      sttConfig: {
        ...sttConfig,
        [field]: value,
      },
    });
  };

  const handlePlaybackConfigChange = (field, value) => {
    onUpdate({
      playbackConfig: {
        ...playbackConfig,
        [field]: value,
      },
    });
  };

  const handleRefAudioChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefAudioFile(file);

      try {
        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();

        // Decode audio to check sample rate and resample if needed
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const originalSampleRate = audioBuffer.sampleRate;

        let processedBuffer = audioBuffer;

        // Resample to 24kHz if needed
        if (originalSampleRate !== 24000) {
          console.log(`Resampling from ${originalSampleRate}Hz to 24000Hz`);
          const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.duration * 24000,
            24000,
          );
          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start();
          processedBuffer = await offlineContext.startRendering();
        }

        audioContext.close();

        // Convert processed buffer to WAV base64
        const wavBlob = audioBufferToWav(processedBuffer);
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target.result.split(",")[1];
          onUpdate({
            voiceConfig: {
              ...config.voiceConfig,
              refAudio: base64,
            },
          });
        };
        reader.readAsDataURL(wavBlob);
      } catch (err) {
        console.error("Failed to process audio:", err);
        // Fallback: just read as base64
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target.result.split(",")[1];
          onUpdate({
            voiceConfig: {
              ...config.voiceConfig,
              refAudio: base64,
            },
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Helper to convert AudioBuffer to WAV
  const audioBufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, totalSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  };

  const handleInstructChange = (e) => {
    onUpdate({
      voiceConfig: {
        ...config.voiceConfig,
        instruct: e.target.value,
      },
    });
  };

  const handleRefTextChange = (e) => {
    onUpdate({
      voiceConfig: {
        ...config.voiceConfig,
        refText: e.target.value,
      },
    });
  };

  const handleVoiceProfileSelect = (profileId) => {
    onUpdate({
      voiceConfig: {
        ...config.voiceConfig,
        selectedProfileId: profileId,
      },
    });
  };

  const handleDeleteProfile = async (id) => {
    try {
      await omnivoice.deleteVoiceProfile(id);
      setVoiceProfiles((prev) => prev.filter((p) => p.id !== id));
      if (config.voiceConfig?.selectedProfileId === id) {
        onUpdate({
          voiceConfig: {
            ...config.voiceConfig,
            selectedProfileId: null,
          },
        });
      }
    } catch (err) {
      console.error("Failed to delete profile:", err);
    }
  };

  const handleCreateProfile = async () => {
    if (!refAudioFile) return;

    const name = prompt("Enter a name for this voice profile:");
    if (!name) return;

    try {
      const profile = await omnivoice.createVoiceProfile(
        refAudioFile,
        name,
        null,
        config.voiceConfig?.refText || null,
      );
      setVoiceProfiles((prev) => [...prev, profile]);
      setRefAudioFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to create profile:", err);
    }
  };

  return (
    <div className="voice-settings">
      {/* Server Status */}
      <div className="settings-section">
        <div className="voice-enable-row">
          <h3 className="section-title">Enable Voice (TTS/STT)</h3>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => handleVoiceEnabledChange(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <p className="form-hint">
          Enable text-to-speech (TTS) for AI responses and speech-to-text (STT)
          for voice input
        </p>
      </div>

      {/* Server Status Indicator */}
      <div className="server-status-section">
        <div className="server-status-row">
          <span className="server-status-label">OmniVoice Server:</span>
          {checkingServer ? (
            <span className="server-status checking">Checking...</span>
          ) : serverStatus?.error ? (
            <span className="server-status offline">Offline</span>
          ) : serverStatus ? (
            <span className="server-status online">Online</span>
          ) : (
            <span className="server-status unknown">Unknown</span>
          )}
          <button
            type="button"
            className="btn-refresh-status"
            onClick={checkServerHealth}
            disabled={checkingServer}
            aria-label="Refresh server status"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M2 7a5 5 0 019-2M12 7a5 5 0 01-9 2M2 3v4h4M12 11v-4H8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {serverStatus?.error && (
          <p className="server-error-hint">
            {serverStatus.error}. Make sure OmniVoice server is running.
          </p>
        )}
        {serverStatus && !serverStatus.error && (
          <div className="server-info">
            {serverStatus.model_loaded !== undefined && (
              <span
                className={`model-status ${serverStatus.model_loaded ? "loaded" : "not-loaded"}`}
              >
                Model: {serverStatus.model_loaded ? "Loaded" : "Loading..."}
              </span>
            )}
            {serverStatus.device && (
              <span className="server-device">{serverStatus.device}</span>
            )}
          </div>
        )}
      </div>

      {voiceEnabled && (
        <div className="voice-settings-content">
          {/* Playback Settings */}
          <div className="settings-section">
            <h3 className="section-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M3 5h2l2-2v10l-2-2H3M9 3l4 5-4 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Playback Settings
            </h3>
            <div className="form-group">
              <label className="toggle-label">
                <span>Auto-play TTS audio</span>
                <label className="toggle-switch small">
                  <input
                    type="checkbox"
                    checked={playbackConfig.autoPlay || false}
                    onChange={(e) =>
                      handlePlaybackConfigChange("autoPlay", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </label>
              <p className="form-hint">
                Automatically play TTS audio when AI response is ready
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">
                Default Volume:{" "}
                {Math.round((playbackConfig.defaultVolume || 1.0) * 100)}%
              </label>
              <input
                type="range"
                className="form-slider"
                min="0"
                max="1"
                step="0.05"
                value={playbackConfig.defaultVolume || 1.0}
                onChange={(e) =>
                  handlePlaybackConfigChange(
                    "defaultVolume",
                    parseFloat(e.target.value),
                  )
                }
              />
              <div className="slider-labels">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Default Playback Speed:{" "}
                {(playbackConfig.defaultSpeed || 1.0).toFixed(2)}x
              </label>
              <input
                type="range"
                className="form-slider"
                min="0.5"
                max="2.0"
                step="0.25"
                value={playbackConfig.defaultSpeed || 1.0}
                onChange={(e) =>
                  handlePlaybackConfigChange(
                    "defaultSpeed",
                    parseFloat(e.target.value),
                  )
                }
              />
              <div className="slider-labels">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>

          {/* STT (Speech-to-Text) Settings */}
          <div className="settings-section">
            <h3 className="section-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M8 1v6M5 4v3M11 4v3M4 7v4c0 2.5 2 4 4 4s4-1.5 4-4V7"
                  strokeLinecap="round"
                />
                <path d="M6 14v1M10 14v1" strokeLinecap="round" />
              </svg>
              Speech Recognition (STT)
            </h3>
            <div className="form-group">
              <label className="form-label">Recognition Language</label>
              <select
                className="form-select"
                value={sttConfig.language || "en-US"}
                onChange={(e) =>
                  handleSttConfigChange("language", e.target.value)
                }
              >
                {STT_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                Select the language you will speak (auto-detect may not work
                reliably)
              </p>
            </div>
            <div className="form-group">
              <label className="toggle-label">
                <span>Continuous recognition</span>
                <label className="toggle-switch small">
                  <input
                    type="checkbox"
                    checked={sttConfig.continuous || false}
                    onChange={(e) =>
                      handleSttConfigChange("continuous", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </label>
              <p className="form-hint">
                Keep listening after each phrase until stopped
              </p>
            </div>
          </div>

          {/* TTS Settings */}
          <div className="settings-section">
            <h3 className="section-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M3 5v6c0 2 1.5 3 3 3s3-1 3-3V5"
                  strokeLinecap="round"
                />
                <path
                  d="M12 6c1.5 1.5 2 3.5 2 5s-.5 3.5-2 5"
                  strokeLinecap="round"
                />
                <path
                  d="M1 9c1.5 1.5 2 3.5 2 5s-.5 3.5-2 5"
                  strokeLinecap="round"
                />
              </svg>
              Text-to-Speech (TTS)
            </h3>
            <div className="voice-mode-selector">
              {Object.values(VOICE_MODES).map((mode) => (
                <button
                  key={mode}
                  className={`voice-mode-btn ${voiceMode === mode ? "active" : ""}`}
                  onClick={() => handleVoiceModeChange(mode)}
                >
                  {mode === "clone" && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M2 3h4v6H2zM8 3h4v6H8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {mode === "design" && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M7 1l2 3h3l-2.5 2.5L11 9l-3-2-3 2 1.5-2.5L3 6h3l2-3z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {mode === "auto" && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M2 5h2l2-2v10l-2-2H2M9 3l3 4-3 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <p className="form-hint">
              {voiceMode === "clone"
                ? "Clone a voice from reference audio for realistic voice synthesis"
                : voiceMode === "design"
                  ? "Design a voice with text description (gender, accent, tone, etc.)"
                  : "Automatically select the best voice for the content"}
            </p>
          </div>

          {voiceMode === "clone" && (
            <div className="settings-section">
              <h3 className="section-title">Voice Clone Settings</h3>

              {/* Voice Profile Selection */}
              {voiceProfiles.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Saved Voice Profiles</label>
                  <div className="voice-profile-grid">
                    {voiceProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className={`voice-profile-card ${config.voiceConfig?.selectedProfileId === profile.id ? "selected" : ""}`}
                        onClick={() => handleVoiceProfileSelect(profile.id)}
                      >
                        <div className="profile-card-icon">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <circle cx="10" cy="7" r="3" />
                            <path
                              d="M3 17c0-3 3-5 7-5s7 2 7 5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div className="profile-card-info">
                          <span className="profile-card-name">
                            {profile.name}
                          </span>
                          <span className="profile-card-date">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="profile-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(profile.id);
                          }}
                          aria-label="Delete profile"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path
                              d="M2 2L10 10M10 2L2 10"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reference Audio</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleRefAudioChange}
                  className="file-input-hidden"
                />
                <button
                  type="button"
                  className="btn btn-secondary upload-audio-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {refAudioFile ? refAudioFile.name : "Upload Audio"}
                </button>
                <p className="form-hint">
                  Upload audio at any sample rate - automatically resampled to
                  24kHz (10-60 seconds recommended)
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Reference Text (Optional)</label>
                <textarea
                  className="form-textarea"
                  value={config.voiceConfig?.refText || ""}
                  onChange={handleRefTextChange}
                  placeholder="Transcription of the reference audio..."
                  rows={3}
                />
                <p className="form-hint">
                  Provide the transcription to improve clone quality
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateProfile}
                disabled={!refAudioFile}
              >
                Save as Voice Profile
              </button>
            </div>
          )}

          {voiceMode === "design" && (
            <div className="settings-section">
              <h3 className="section-title">Voice Design Settings</h3>
              <div className="form-group">
                <label className="form-label">Voice Description</label>
                <textarea
                  className="form-textarea"
                  value={config.voiceConfig?.instruct || ""}
                  onChange={handleInstructChange}
                  placeholder="e.g., male, british accent, middle-aged"
                  rows={3}
                />
                <p className="form-hint">
                  Use comma-separated tags: female/male, accent (american,
                  british, indian...), age (young adult, middle-aged, elderly)
                </p>
              </div>
              <div className="voice-presets">
                <span className="presets-label">Quick presets:</span>
                <div className="preset-buttons">
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInstructChange({
                        target: {
                          value: "male, american accent, middle-aged",
                        },
                      })
                    }
                  >
                    American Male
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInstructChange({
                        target: {
                          value: "female, british accent",
                        },
                      })
                    }
                  >
                    British Female
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInstructChange({
                        target: {
                          value: "neutral, moderate pitch",
                        },
                      })
                    }
                  >
                    Neutral
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() =>
                      handleInstructChange({
                        target: {
                          value: "young adult, american accent",
                        },
                      })
                    }
                  >
                    Young American
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-section">
            <h3 className="section-title">Generation Settings</h3>
            <div className="form-group">
              <label className="form-label">Output Language</label>
              <select
                className="form-select"
                value={generationConfig.language || ""}
                onChange={(e) =>
                  handleGenerationConfigChange(
                    "language",
                    e.target.value || null,
                  )
                }
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id || "auto"} value={lang.id || ""}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                Language for TTS output (auto-detect if not set)
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">
                Speed: {generationConfig.speed?.toFixed(2) || 1.0}x
              </label>
              <input
                type="range"
                className="form-slider"
                min="0.5"
                max="2.0"
                step="0.1"
                value={generationConfig.speed || 1.0}
                onChange={(e) =>
                  handleGenerationConfigChange(
                    "speed",
                    parseFloat(e.target.value),
                  )
                }
              />
              <div className="slider-labels">
                <span>0.5x (Slower)</span>
                <span>2.0x (Faster)</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Quality (Steps): {generationConfig.numStep ?? 48}
              </label>
              <input
                type="range"
                className="form-slider"
                min="16"
                max="64"
                step="1"
                value={generationConfig.numStep ?? 48}
                onChange={(e) =>
                  handleGenerationConfigChange(
                    "numStep",
                    parseInt(e.target.value, 10),
                  )
                }
              />
              <div className="slider-labels">
                <span>16 (Fast)</span>
                <span>64 (Best)</span>
              </div>
              <p className="form-hint">
                Higher steps improve clarity; replies are cleaned for speech
                (markdown stripped before synthesis).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceSettings;
