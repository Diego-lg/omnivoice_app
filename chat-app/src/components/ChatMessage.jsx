import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./ChatMessage.css";
import TypingIndicator from "./TypingIndicator";

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const ChatMessage = React.forwardRef(function ChatMessage(
  { message, onBranchClick, textFormatConfig },
  ref,
) {
  const isUser = message.role === "user";
  const isError = message.isError;
  const isStreaming = message.isStreaming;
  const images = message.images || [];
  const hasAudio = message.audioUrl || message.audioBlob;
  const transcript = message.transcript || null;
  const autoPlay = message.autoPlay || false;

  // Get formatting options with defaults
  const fontSize = textFormatConfig?.fontSize || "medium";
  const fontFamily = textFormatConfig?.fontFamily || "system";
  const codeStyle = textFormatConfig?.codeStyle || "dark";
  const enableMarkdown = textFormatConfig?.markdown !== false;

  // Build dynamic class names for formatting
  const formatClasses = [
    `format-font-${fontSize}`,
    `format-font-${fontFamily}`,
    enableMarkdown ? "format-markdown" : "format-plain",
  ].join(" ");

  // Map code style to syntax highlighter theme
  const codeThemeMap = {
    dark: oneDark,
    light: "prism-light",
    dracula: "prism-dracula",
    nord: "prism-nord",
  };
  const codeTheme = codeThemeMap[codeStyle] || oneDark;

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef(null);
  const volumeRef = useRef(null);

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

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current
        .play()
        .catch((err) => console.warn("Audio play failed:", err));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleAudioTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    setAudioProgress(audioRef.current.currentTime);
  }, []);

  const handleAudioLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
    if (volumeRef.current) {
      audioRef.current.volume = volume;
    }
    // Auto-play if enabled
    if (autoPlay && !isPlaying) {
      audioRef.current
        .play()
        .catch((err) => console.warn("Auto-play failed:", err));
      setIsPlaying(true);
    }
  }, [autoPlay, volume, isPlaying]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setAudioProgress(0);
  }, []);

  const handleProgressBarClick = (e) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    audioRef.current.currentTime = percent * audioDuration;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const downloadAudio = () => {
    const url = getAudioUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `voice-response-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      className={`message ${isUser ? "message-user" : "message-assistant"} ${isError ? "message-error" : ""} ${isStreaming ? "message-streaming" : ""} ${formatClasses}`}
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
              {enableMarkdown ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={codeTheme}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: "16px 0",
                            borderRadius: "8px",
                            backgroundColor:
                              codeStyle === "light" ? "#f5f5f5" : "#1A1A1A",
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
              ) : (
                <div className="plain-text-content">
                  {message.content}
                </div>
              )}
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
                <div className="audio-progress-wrapper">
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
                  <div className="audio-time-display">
                    <span>{formatAudioTime(audioProgress)}</span>
                    <span className="audio-time-separator">/</span>
                    <span>{formatAudioTime(audioDuration)}</span>
                  </div>
                </div>
                <div className="audio-controls-right">
                  <div className="volume-control">
                    <button
                      className="volume-btn"
                      onClick={() => setVolume(volume > 0 ? 0 : 1)}
                      aria-label={volume > 0 ? "Mute" : "Unmute"}
                    >
                      {volume === 0 ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M2 5h2l3-3v10l-3-3H2M9 4l3 3M12 4l-3 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M2 5h2l3-3v10l-3-3H2M5 4.5a4 4 0 010 5M7.5 2.5a6 6 0 010 9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                    <input
                      ref={volumeRef}
                      type="range"
                      className="volume-slider"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={handleVolumeChange}
                      aria-label="Volume"
                    />
                  </div>
                  <div className="speed-control">
                    <button
                      className="speed-btn"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      aria-label="Playback speed"
                    >
                      {playbackSpeed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="speed-menu">
                        {PLAYBACK_SPEEDS.map((speed) => (
                          <button
                            key={speed}
                            className={`speed-menu-item ${playbackSpeed === speed ? "active" : ""}`}
                            onClick={() => handleSpeedChange(speed)}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="download-btn"
                    onClick={downloadAudio}
                    aria-label="Download audio"
                    title="Download audio"
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
                        d="M7 1v8M4 6l3 3 3-3M2 11h10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                {transcript && (
                  <button
                    className="transcript-toggle"
                    onClick={() => setShowTranscript(!showTranscript)}
                    aria-label={
                      showTranscript ? "Hide transcript" : "Show transcript"
                    }
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M1 2h10M1 6h10M1 10h6" strokeLinecap="round" />
                    </svg>
                    {showTranscript ? "Hide" : "Show"} transcript
                  </button>
                )}
                {showTranscript && transcript && (
                  <div className="audio-transcript">{transcript}</div>
                )}
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
