import { useState } from "react";
import { MINIMAX_MODELS } from "../services/api";
import VoiceSettings from "./VoiceSettings";
import "./SettingsModal.css";

const TABS = {
  PROVIDER: "provider",
  VOICE: "voice",
  FORMATTING: "formatting",
};

function SettingsModal({ config, onUpdate, onClose }) {
  const [localConfig, setLocalConfig] = useState(config);
  const [activeTab, setActiveTab] = useState(TABS.PROVIDER);

  const handleChange = (field, value) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Wrapper for VoiceSettings to pass partial updates through localConfig
  // Properly merges nested objects like voiceConfig
  const handleVoiceSettingsUpdate = (updates) => {
    setLocalConfig((prev) => {
      const newConfig = { ...prev, ...updates };
      // Deep merge nested objects
      if (updates.voiceConfig && prev.voiceConfig) {
        newConfig.voiceConfig = { ...prev.voiceConfig, ...updates.voiceConfig };
      }
      if (updates.voiceGenerationConfig && prev.voiceGenerationConfig) {
        newConfig.voiceGenerationConfig = {
          ...prev.voiceGenerationConfig,
          ...updates.voiceGenerationConfig,
        };
      }
      if (updates.sttConfig && prev.sttConfig) {
        newConfig.sttConfig = { ...prev.sttConfig, ...updates.sttConfig };
      }
      if (updates.playbackConfig && prev.playbackConfig) {
        newConfig.playbackConfig = {
          ...prev.playbackConfig,
          ...updates.playbackConfig,
        };
      }
      return newConfig;
    });
  };

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 4L16 16M16 4L4 16" />
            </svg>
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === TABS.PROVIDER ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.PROVIDER)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 1v14M1 8h14" strokeLinecap="round" />
            </svg>
            Provider
          </button>
          <button
            className={`settings-tab ${activeTab === TABS.VOICE ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.VOICE)}
          >
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
            </svg>
            Voice
          </button>
          <button
            className={`settings-tab ${activeTab === TABS.FORMATTING ? "active" : ""}`}
            onClick={() => setActiveTab(TABS.FORMATTING)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
            </svg>
            Formatting
          </button>
        </div>

        <div className="modal-body">
          {activeTab === TABS.PROVIDER && (
            <>
              {localConfig.provider === "minimax" ? (
                <div className="settings-section">
                  <h3 className="section-title">MiniMax API Configuration</h3>
                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      value={localConfig.minimaxApiKey}
                      onChange={(e) =>
                        handleChange("minimaxApiKey", e.target.value)
                      }
                      placeholder="Enter your MiniMax API key"
                    />
                    <p className="form-hint">
                      Get your API key from the MiniMax dashboard
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <select
                      className="form-select"
                      value={localConfig.minimaxModel}
                      onChange={(e) =>
                        handleChange("minimaxModel", e.target.value)
                      }
                    >
                      {MINIMAX_MODELS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <p className="form-hint">Select the MiniMax model to use</p>
                  </div>
                </div>
              ) : localConfig.provider === "omnivoice" ? (
                <div className="settings-section">
                  <h3 className="section-title">OmniVoice Configuration</h3>
                  <div className="form-group">
                    <label className="form-label">Server URL</label>
                    <input
                      type="text"
                      className="form-input"
                      value={
                        localConfig.omnivoiceBaseUrl || "http://localhost:8005"
                      }
                      onChange={(e) =>
                        handleChange("omnivoiceBaseUrl", e.target.value)
                      }
                      placeholder="http://localhost:8005"
                    />
                    <p className="form-hint">
                      The URL where OmniVoice server is running
                    </p>
                  </div>
                  <p className="form-hint voice-provider-hint">
                    Configure voice settings in the <strong>Voice</strong> tab.
                  </p>
                </div>
              ) : null}
            </>
          )}

          {activeTab === TABS.VOICE && (
            <VoiceSettings
              config={localConfig}
              onUpdate={handleVoiceSettingsUpdate}
            />
          )}

          {activeTab === TABS.FORMATTING && (
            <div className="settings-section">
              <h3 className="section-title">Text Formatting</h3>
              <div className="form-group">
                <label className="form-label">Font Size</label>
                <select
                  className="form-select"
                  value={localConfig.textFormatConfig?.fontSize || "medium"}
                  onChange={(e) =>
                    handleVoiceSettingsUpdate({
                      textFormatConfig: {
                        ...localConfig.textFormatConfig,
                        fontSize: e.target.value,
                      },
                    })
                  }
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="extra-large">Extra Large</option>
                </select>
                <p className="form-hint">
                  Adjust the text size for chat messages
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Font Family</label>
                <select
                  className="form-select"
                  value={localConfig.textFormatConfig?.fontFamily || "system"}
                  onChange={(e) =>
                    handleVoiceSettingsUpdate({
                      textFormatConfig: {
                        ...localConfig.textFormatConfig,
                        fontFamily: e.target.value,
                      },
                    })
                  }
                >
                  <option value="system">System Default</option>
                  <option value="serif">Serif</option>
                  <option value="sans-serif">Sans-serif</option>
                  <option value="monospace">Monospace</option>
                </select>
                <p className="form-hint">
                  Choose the font family for code blocks
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Code Theme</label>
                <select
                  className="form-select"
                  value={localConfig.textFormatConfig?.codeStyle || "dark"}
                  onChange={(e) =>
                    handleVoiceSettingsUpdate({
                      textFormatConfig: {
                        ...localConfig.textFormatConfig,
                        codeStyle: e.target.value,
                      },
                    })
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="dracula">Dracula</option>
                  <option value="nord">Nord</option>
                </select>
                <p className="form-hint">
                  Choose the syntax highlighting theme for code
                </p>
              </div>
              <div className="form-group">
                <label className="form-label toggle-label">
                  <span>Markdown Rendering</span>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={localConfig.textFormatConfig?.markdown !== false}
                    onChange={(e) =>
                      handleVoiceSettingsUpdate({
                        textFormatConfig: {
                          ...localConfig.textFormatConfig,
                          markdown: e.target.checked,
                        },
                      })
                    }
                  />
                </label>
                <p className="form-hint">
                  Enable or disable markdown formatting in messages
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
