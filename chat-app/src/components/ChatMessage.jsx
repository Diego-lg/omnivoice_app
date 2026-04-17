import "./ChatMessage.css";

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const isError = message.isError;

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={`message ${isUser ? "message-user" : "message-assistant"} ${isError ? "message-error" : ""}`}
    >
      <div className="message-bubble">
        {message.isLoading ? (
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          <>
            <p className="message-content">{message.content}</p>
            <span className="message-time">
              {formatTime(message.timestamp)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
