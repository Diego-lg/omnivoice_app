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

function VoiceSettings({ config, onUpdate }) {
  const [voiceProfiles, setVoiceProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [refAudioFile, setRefAudioFile] = useState(null);
  const fileInputRef = useRef(null);

  const voiceEnabled = config.voiceEnabled || false;
  const voiceMode = config.voiceMode || "auto";
  const generationConfig = config.voiceGenerationConfig || {
    language: null,
    speed: 1.0,
    numStep: 32,
  };

  useEffect(() => {
    loadVoiceProfiles();
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

  const handleRefAudioChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefAudioFile(file);
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

  const handleDeleteProfile = async (id) => {
    try {
      await omnivoice.deleteVoiceProfile(id);
      setVoiceProfiles((prev) => prev.filter((p) => p.id !== id));
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
      <div className="settings-section">
        <div className="voice-enable-row">
          <h3 className="section-title">Enable Voice (TTS)</h3>
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
          When enabled, AI responses will be converted to speech using OmniVoice
        </p>
      </div>

      {voiceEnabled && (
        <div className="voice-settings-content">
          <div className="settings-section">
            <h3 className="section-title">Voice Mode</h3>
            <div className="voice-mode-selector">
              {Object.values(VOICE_MODES).map((mode) => (
                <button
                  key={mode}
                  className={`voice-mode-btn ${voiceMode === mode ? "active" : ""}`}
                  onClick={() => handleVoiceModeChange(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <p className="form-hint">
              {voiceMode === "clone"
                ? "Clone a voice from reference audio"
                : voiceMode === "design"
                  ? "Design a voice with text description"
                  : "Automatically select the best voice"}
            </p>
          </div>

          {voiceMode === "clone" && (
            <div className="settings-section">
              <h3 className="section-title">Voice Clone Settings</h3>
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
                  Upload a clear audio sample (24kHz WAV recommended, 10-60 seconds)
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
                  placeholder="e.g., Male voice, British accent, warm and professional..."
                  rows={3}
                />
                <p className="form-hint">
                  Describe the voice characteristics (gender, accent, tone, etc.)
                </p>
              </div>
            </div>
          )}

          <div className="settings-section">
            <h3 className="section-title">Generation Settings</h3>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                className="form-select"
                value={generationConfig.language || ""}
                onChange={(e) =>
                  handleGenerationConfigChange("language", e.target.value || null)
                }
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id || "auto"} value={lang.id || ""}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Speed: {generationConfig.speed?.toFixed(2) || 1.0}
              </label>
              <input
                type="range"
                className="form-slider"
                min="0.5"
                max="2.0"
                step="0.1"
                value={generationConfig.speed || 1.0}
                onChange={(e) =>
                  handleGenerationConfigChange("speed", parseFloat(e.target.value))
                }
              />
              <div className="slider-labels">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Quality (Steps): {generationConfig.numStep || 32}
              </label>
              <input
                type="range"
                className="form-slider"
                min="16"
                max="32"
                step="1"
                value={generationConfig.numStep || 32}
                onChange={(e) =>
                  handleGenerationConfigChange("numStep", parseInt(e.target.value))
                }
              />
              <div className="slider-labels">
                <span>16 (Fast)</span>
                <span>32 (High Quality)</span>
              </div>
              <p className="form-hint">
                Higher steps produce better quality but take longer
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title">Saved Voice Profiles</h3>
            {loadingProfiles ? (
              <div className="loading-text">Loading profiles...</div>
            ) : voiceProfiles.length === 0 ? (
              <div className="empty-profiles">
                <p>No saved voice profiles</p>
                <p className="form-hint">
                  Upload reference audio in clone mode and save it as a profile
                </p>
              </div>
            ) : (
              <div className="voice-profiles-list">
                {voiceProfiles.map((profile) => (
                  <div key={profile.id} className="voice-profile-item">
                    <div className="profile-info">
                      <span className="profile-name">{profile.name}</span>
                      <span className="profile-date">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-delete-profile"
                      onClick={() => handleDeleteProfile(profile.id)}
                      aria-label="Delete profile"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M2 2L12 12M12 2L2 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceSettings;
