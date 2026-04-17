import { useState, useMemo } from "react";
import "./ChatHistory.css";

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChatHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onExportSession,
  onToggleHistory,
  isOpen,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [renameSessionId, setRenameSessionId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(query) ||
        session.messages.some((m) => m.content.toLowerCase().includes(query)),
    );
  }, [sessions, searchQuery]);

  const handleStartRename = (session) => {
    setRenameSessionId(session.id);
    setRenameValue(session.title);
  };

  const handleSaveRename = () => {
    if (renameValue.trim() && renameSessionId) {
      onRenameSession(renameSessionId, renameValue.trim());
    }
    setRenameSessionId(null);
    setRenameValue("");
  };

  const handleCancelRename = () => {
    setRenameSessionId(null);
    setRenameValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  return (
    <>
      <div
        className={`chat-history-backdrop ${isOpen ? "visible" : ""}`}
        onClick={onToggleHistory}
      />
      <div className={`chat-history ${isOpen ? "open" : ""}`}>
        <div className="chat-history-header">
          <span className="chat-history-title">History</span>
          <button
            className="header-btn"
            onClick={onToggleHistory}
            aria-label="Close history"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          New Chat
        </button>

        <div className="chat-history-search">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chat-history-list">
          {filteredSessions.length === 0 ? (
            <div className="chat-history-empty">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
              </svg>
              <p>
                {searchQuery
                  ? "No conversations found"
                  : "No conversations yet.\nStart chatting to see history here."}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`chat-history-item ${
                  session.id === currentSessionId ? "active" : ""
                }`}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="chat-history-item-content">
                  {renameSessionId === session.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSaveRename}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        padding: "4px 8px",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--accent)",
                        borderRadius: "4px",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />
                  ) : (
                    <>
                      <div className="chat-history-item-title">
                        {session.title}
                      </div>
                      <div className="chat-history-item-meta">
                        <span>{formatTimeAgo(session.updatedAt)}</span>
                        <span>•</span>
                        <span>
                          {session.messages.length}{" "}
                          {session.messages.length === 1 ? "msg" : "msgs"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {renameSessionId !== session.id && (
                  <div className="chat-history-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(session);
                      }}
                      title="Rename"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M11.5 2.5l2 2L5 13l-3 1 1-3 8.5-8.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportSession(session.id);
                      }}
                      title="Export"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 2v8M5 5l3-3 3 3M3 10v3a1 1 0 001 1h8a1 1 0 001-1v-3" />
                      </svg>
                    </button>
                    <button
                      className="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4M7 7v4M9 7v4M4 4l1 10h6l1-10" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="chat-history-footer">
          <button onClick={() => onExportSession()}>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 5h12M8 2v8M5 5l3-3 3 3" />
              <path d="M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" />
            </svg>
            Export All Chats
          </button>
        </div>
      </div>

      <button
        className={`chat-history-toggle ${isOpen ? "open" : ""}`}
        onClick={onToggleHistory}
        aria-label={isOpen ? "Close history" : "Open history"}
      >
        <svg
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 4l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}

export default ChatHistory;
