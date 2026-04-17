import { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import "./ChatContainer.css";

function ChatContainer({
  messages,
  chatEndRef,
  error,
  scrollToIndex,
  onBranchClick,
  textFormatConfig,
}) {
  const hasMessages = messages.length > 0;
  const messageRefs = useRef([]);

  useEffect(() => {
    if (
      typeof scrollToIndex === "number" &&
      messageRefs.current[scrollToIndex]
    ) {
      messageRefs.current[scrollToIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [scrollToIndex]);

  return (
    <div className="chat-container">
      {!hasMessages && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 12h32v24H8z" strokeLinejoin="round" />
              <path d="M16 12V8a2 2 0 012-2h16a2 2 0 012 2v4" />
              <circle cx="24" cy="28" r="4" />
            </svg>
          </div>
          <p className="empty-text">Start a conversation</p>
          <p className="empty-hint">Send a message to begin chatting with AI</p>
        </div>
      )}
      <div className="messages-list">
        {messages.map((msg, index) => (
          <ChatMessage
            key={msg.id}
            ref={(el) => (messageRefs.current[index] = el)}
            message={msg}
            onBranchClick={onBranchClick}
            textFormatConfig={textFormatConfig}
          />
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

export default ChatContainer;
