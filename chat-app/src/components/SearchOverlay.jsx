import { useState, useEffect, useRef } from "react";
import "./SearchOverlay.css";

function SearchOverlay({ messages, onClose, onNavigate }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const term = searchTerm.toLowerCase();
    const matches = messages
      .map((msg, index) => {
        const content = msg.content || "";
        const lowerContent = content.toLowerCase();
        const indices = [];
        let pos = 0;

        while ((pos = lowerContent.indexOf(term, pos)) !== -1) {
          indices.push(pos);
          pos += 1;
        }

        if (indices.length > 0) {
          return {
            messageIndex: index,
            message: msg,
            matchCount: indices.length,
            preview: getPreview(content, indices[0], term.length),
            matchStart: indices[0],
          };
        }
        return null;
      })
      .filter(Boolean);

    setResults(matches);
    setSelectedIndex(0);
  }, [searchTerm, messages]);

  const getPreview = (content, matchPos, termLength) => {
    const start = Math.max(0, matchPos - 30);
    const end = Math.min(content.length, matchPos + termLength + 50);
    let preview = content.slice(start, end);

    if (start > 0) preview = "..." + preview;
    if (end < content.length) preview = preview + "...";

    return preview;
  };

  const highlightText = (text, term) => {
    if (!term) return text;

    const parts = [];
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    let lastIndex = 0;
    let index = 0;

    while ((index = lowerText.indexOf(lowerTerm, lastIndex)) !== -1) {
      if (index > lastIndex) {
        parts.push(text.slice(lastIndex, index));
      }
      parts.push(
        <mark key={index} className="search-highlight">
          {text.slice(index, index + term.length)}
        </mark>,
      );
      lastIndex = index + term.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      handleResultClick(results[selectedIndex]);
    }
  };

  const handleResultClick = (result) => {
    onNavigate(result.messageIndex);
    onClose();
  };

  return (
    <div className="search-overlay">
      <div className="search-container">
        <div className="search-header">
          <svg
            className="search-icon"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M13 13l4 4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="search-close-btn" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="search-results-info">
          {searchTerm.trim() && (
            <span>
              {results.length > 0
                ? `Found ${results.length} match${results.length !== 1 ? "es" : ""}`
                : "No messages found"}
            </span>
          )}
        </div>

        <div className="search-results">
          {results.map((result, index) => (
            <button
              key={result.messageIndex}
              className={`search-result-item ${index === selectedIndex ? "selected" : ""}`}
              onClick={() => handleResultClick(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="result-role">
                {result.message.role === "user" ? "You" : "Assistant"}
              </span>
              <span className="result-preview">
                {highlightText(result.preview, searchTerm)}
              </span>
              {result.matchCount > 1 && (
                <span className="result-count">
                  {result.matchCount} matches
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="search-footer">
          <span>
            <kbd>↑↓</kbd> Navigate
          </span>
          <span>
            <kbd>Enter</kbd> Go to message
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}

export default SearchOverlay;
