import React, { useState, useRef, useEffect } from "react";
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
  const hasAudio = message.audioUrl || message.audioBlob;

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(null);

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatAudioTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAudioUrl = () => {
    if (message.audioUrl) return message.audioUrl;
    if (message.audioBlob) return URL.createObjectURL(message.audioBlob);
    return null;
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleAudioLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const handleProgressBarClick = (e) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * audioDuration;
    setAudioProgress(audioRef.current.currentTime);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (message.audioBlob && message.audioUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(message.audioUrl);
      }
    };
  }, [message.audioBlob, message.audioUrl]);

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
            {hasAudio && (
              <div className="audio-player">
                <audio
                  ref={audioRef}
                  src={getAudioUrl()}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onLoadedMetadata={handleAudioLoadedMetadata}
                  onEnded={handleAudioEnded}
                />
                <button
                  className="audio-play-btn"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <rect x="3" y="2" width="4" height="12" rx="1" />
                      <rect x="9" y="2" width="4" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M4 2.5v11l9-5.5z" />
                    </svg>
                  )}
                </button>
                <div
                  className="audio-progress-container"
                  onClick={handleProgressBarClick}
                >
                  <div className="audio-progress-bar">
                    <div
                      className="audio-progress-fill"
                      style={{
                        width: `${(audioProgress / audioDuration) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="audio-time">
                  {formatAudioTime(audioProgress)} /{" "}
                  {formatAudioTime(audioDuration)}
                </span>
              </div>
            )}
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
