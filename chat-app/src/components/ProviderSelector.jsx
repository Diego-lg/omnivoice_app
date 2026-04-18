import "./ProviderSelector.css";

function ProviderSelector({ value, onChange }) {
  return (
    <div className="provider-selector">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="provider-select"
      >
        <option value="minimax">MiniMax API</option>
      </select>
      <div className="status-indicator">
        <span
          className={`status-dot ${
            value === "minimax" ? "status-api" : "status-local"
          }`}
        />
      </div>
    </div>
  );
}

export default ProviderSelector;
