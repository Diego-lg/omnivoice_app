import "./TypingIndicator.css";

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span className="typing-text">AI is thinking...</span>
      <div className="typing-dots">
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
      </div>
    </div>
  );
}

export default TypingIndicator;
