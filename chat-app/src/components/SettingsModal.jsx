import { useState, useEffect } from "react";
import { ollama, MINIMAX_MODELS } from "../services/api";
import VoiceSettings from "./VoiceSettings";
import "./SettingsModal.css";

function SettingsModal({ config, onUpdate, onClose }) {
  const [localConfig, setLocalConfig] = useState(config);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (localConfig.provider === "ollama") {
      fetchModels();
    }
  }, [localConfig.provider, localConfig.ollamaBaseUrl]);

  const fetchModels = async () => {
    setLoadingModels(true);
    const fetchedModels = await ollama.fetchOllamaModels(
      localConfig.ollamaBaseUrl,
    );
    setModels(fetchedModels);
    if (
      fetchedModels.length > 0 &&
      !fetchedModels.includes(localConfig.ollamaModel)
    ) {
      onUpdate({ ollamaModel: fetchedModels[0] });
    }
    setLoadingModels(false);
  };

  const handleChange = (field, value) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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

        <div className="modal-body">
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
                  onChange={(e) => handleChange("minimaxModel", e.target.value)}
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
            <VoiceSettings config={localConfig} onUpdate={onUpdate} />
          ) : (
            <div className="settings-section">
              <h3 className="section-title">Ollama Configuration</h3>
              <div className="form-group">
                <label className="form-label">Base URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={localConfig.ollamaBaseUrl}
                  onChange={(e) =>
                    handleChange("ollamaBaseUrl", e.target.value)
                  }
                  placeholder="http://localhost:11434"
                />
                <p className="form-hint">The URL where Ollama is running</p>
              </div>
              <div className="form-group">
                <label className="form-label">Model</label>
                {loadingModels ? (
                  <div className="model-loading">Loading models...</div>
                ) : models.length > 0 ? (
                  <select
                    className="form-select"
                    value={localConfig.ollamaModel}
                    onChange={(e) =>
                      handleChange("ollamaModel", e.target.value)
                    }
                  >
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="model-empty">
                    <p>No models found</p>
                    <p className="form-hint">
                      Make sure Ollama is running with:{" "}
                      <code>ollama serve</code>
                    </p>
                  </div>
                )}
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
