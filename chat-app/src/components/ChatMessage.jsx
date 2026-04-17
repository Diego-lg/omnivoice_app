import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./ChatMessage.css";
import TypingIndicator from "./TypingIndicator";

const ChatMessage = React.forwardRef(function ChatMessage(
  { message, onBranchClick },
  ref,
) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = message.isStreaming;
  const images = message.images || [];

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      ref={ref}
      className={`message ${isUser ? "message-user" : "message-assistant"} ${isError ? "message-error" : ""} ${isStreaming ? "message-streaming" : ""}`}
    >
      <div className="message-bubble">
        {message.isLoading && !message.content ? (
          <TypingIndicator />
        ) : (
          <>
            {images.length > 0 && (
              <div
                className={`message-images ${images.length > 1 ? "multiple" : ""}`}
              >
                {images.map((image, index) => (
                  <img
                    key={index}
                    src={image.dataUrl}
                    alt={image.name || `Image ${index + 1}`}
                    className="message-image"
                  />
                ))}
              </div>
            )}
            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: "16px 0",
                          borderRadius: "8px",
                          backgroundColor: "#1A1A1A",
                          fontSize: "13px",
                        }}
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="streaming-indicator">
                  <span className="streaming-dot"></span>
                  <span className="blinking-cursor">█</span>
                </span>
              )}
            </div>
            <div className="message-footer">
              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
              {isUser && onBranchClick && (
                <button
                  className="branch-btn"
                  onClick={() => onBranchClick(message.id)}
                  aria-label="Branch conversation from this message"
                  title="Branch from this message"
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
                      d="M5 2C5 1.44772 5.44772 1 6 1C6.55228 1 7 1.44772 7 2V8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 5C9 4.44772 9.44772 4 10 4C10.5523 4 11 4.44772 11 5V11C11 11.5523 10.5523 12 10 12C9.44772 12 9 11.5523 9 11"
                      strokeLinecap="round"
                    />
                    <circle cx="2" cy="6.5" r="1.5" />
                    <circle cx="12" cy="6.5" r="1.5" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
