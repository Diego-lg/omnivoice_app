import { useState } from "react";
import ProviderSelector from "./ProviderSelector";
import "./Header.css";

function Header({ config, onProviderChange, onSettingsClick, onClearChat }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">OMNIVOICE</h1>
      </div>
      <div className="header-right">
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
