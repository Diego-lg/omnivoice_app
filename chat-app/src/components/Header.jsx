import { useState } from "react";
import ProviderSelector from "./ProviderSelector";
import PersonaSelector from "./PersonaSelector";
import "./Header.css";

function Header({
  config,
  branches,
  currentBranchName,
  personas,
  selectedPersonaId,
  onProviderChange,
  onPersonaChange,
  onEditPersonas,
  onSettingsClick,
  onClearChat,
  onSearchClick,
  onBranchSwitch,
  onBranchCreate,
  showBranchSelector,
  onToggleBranchSelector,
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">OMNIVOICE</h1>
        <button
          className="branch-indicator"
          onClick={onToggleBranchSelector}
          aria-label="Switch branch"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M5 2C5 1.44772 5.44772 1 6 1C6.55228 1 7 1.44772 7 2V8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8" strokeLinecap="round" />
            <path d="M9 5C9 4.44772 9.44772 4 10 4C10.5523 4 11 4.44772 11 5V11C11 11.5523 10.5523 12 10 12C9.44772 12 9 11.5523 9 11" strokeLinecap="round" />
            <circle cx="2" cy="6.5" r="1.5" />
            <circle cx="12" cy="6.5" r="1.5" />
          </svg>
          <span>{currentBranchName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`dropdown-arrow ${showBranchSelector ? 'open' : ''}`}
          >
            <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {showBranchSelector && (
          <>
            <div className="branch-overlay" onClick={onToggleBranchSelector} />
            <div className="branch-dropdown">
              {branches.branches.map((branch) => (
                <button
                  key={branch.id}
                  className={`branch-option ${branch.id === branches.currentBranchId ? 'active' : ''}`}
                  onClick={() => onBranchSwitch(branch.id)}
                >
                  <span className="branch-name">{branch.name}</span>
                  {branch.parentBranchId && (
                    <span className="branch-lineage">child of {branches.branches.find(b => b.id === branch.parentBranchId)?.name}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="header-right">
        <button
          className="header-btn"
          onClick={onSearchClick}
          aria-label="Search messages"
          title="Search messages"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M13 13l4 4" strokeLinecap="round" />
          </svg>
        </button>
        <PersonaSelector
          personas={personas}
          selectedPersonaId={selectedPersonaId}
          onPersonaChange={onPersonaChange}
          onEditPersonas={onEditPersonas}
        />
        <ProviderSelector value={config.provider} onChange={onProviderChange} />
        <button
          className="header-btn"
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
        {showMenu && (
          <>
            <div className="menu-overlay" onClick={() => setShowMenu(false)} />
            <div className="menu-dropdown">
              <button
                onClick={() => {
                  onSettingsClick();
                  setShowMenu(false);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="8" cy="8" r="2" />
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4" />
                </svg>
                Settings
              </button>
              <button
                onClick={() => {
                  onClearChat();
                  setShowMenu(false);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
                </svg>
                Clear Chat
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
