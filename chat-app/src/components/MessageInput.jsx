import { useState, useRef, useCallback, useEffect } from "react";
import RealtimeStsToggle from "./RealtimeStsToggle";
import "./MessageInput.css";

const MAX_IMAGES = 4;

function MessageInput({
  onSend,
  disabled,
  sttConfig,
  realtimeStsEnabled = false,
  onRealtimeStsToggle,
}) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const previewAudioRef = useRef(null);
  const recognitionRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  /** Live captions from the mic while recording (Web Speech API) — sent to the LLM with the clip. */
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const voiceTranscriptRef = useRef("");
  /** True between MediaRecorder.start and .stop — used to restart STT if it ends mid-take. */
  const recordingActiveRef = useRef(false);
  const inputRef = useRef("");
  const imagesRef = useRef([]);
  const onSendRef = useRef(onSend);
  const disabledRef = useRef(disabled);

  inputRef.current = input;
  imagesRef.current = images;
  onSendRef.current = onSend;
  disabledRef.current = disabled;

  /** Matches CSS mobile breakpoint — tap-to-send after stop instead of preview + send. */
  const isMobileRecordingAutoSend = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;

  const [narrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setNarrowViewport(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
  }, []);

  /**
   * @param {{ discardPartialRecording?: boolean }} opts
   * If discardPartialRecording, the in-progress take is aborted (no new blob)
   * — used when the user sends while the mic is still open.
   */
  const stopRecording = useCallback(
    (opts = {}) => {
      const { discardPartialRecording = false } = opts;
      const mr = mediaRecorderRef.current;
      if (!mr || (mr.state !== "recording" && mr.state !== "paused")) return;

      recordingActiveRef.current = false;

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      stopSpeechRecognition();

      if (discardPartialRecording) {
        mr.onstop = () => {
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        };
      }

      try {
        mr.stop();
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current = null;
      setIsRecording(false);
    },
    [stopSpeechRecognition],
  );

  const handleSubmit = useCallback(() => {
    const typed = input.trim();
    const spoken = (voiceTranscriptRef.current || voiceTranscript).trim();
    const combined =
      typed && spoken ? `${typed}\n\n${spoken}` : typed || spoken;
    if ((!combined && images.length === 0 && !recordedBlob) || disabled) return;

    const mr = mediaRecorderRef.current;
    if (mr && (mr.state === "recording" || mr.state === "paused")) {
      stopRecording({ discardPartialRecording: true });
    }

    onSend(combined, images, recordedBlob);
    setInput("");
    setVoiceTranscript("");
    voiceTranscriptRef.current = "";
    setImages([]);
    setRecordedBlob(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [
    input,
    voiceTranscript,
    images,
    recordedBlob,
    disabled,
    onSend,
    stopRecording,
  ]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = useCallback((e) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = `${newHeight}px`;
  }, []);

  const handleFileSelect = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      addImages(files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [images],
  );

  const addImages = useCallback(
    (files) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const remainingSlots = MAX_IMAGES - images.length;
      const filesToAdd = imageFiles.slice(0, remainingSlots);

      if (filesToAdd.length === 0) return;

      const readers = filesToAdd.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              name: file.name,
              dataUrl: e.target.result,
            });
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then((newImages) => {
        setImages((prev) => [...prev, ...newImages]);
      });
    },
    [images],
  );

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      addImages(files);
    },
    [addImages],
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Pick the best MIME type the browser actually supports
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : {},
      );
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the recorder's actual mimeType so the blob format always matches
        const usedMime = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: usedMime });

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const tryMobileAutoSend =
          isMobileRecordingAutoSend() &&
          blob.size > 0 &&
          !disabledRef.current;

        if (tryMobileAutoSend) {
          const typed = inputRef.current.trim();
          const spoken = (voiceTranscriptRef.current || "").trim();
          let combined =
            typed && spoken ? `${typed}\n\n${spoken}` : typed || spoken;
          combined = combined.trim();
          const imgs = imagesRef.current;
          if (!combined && imgs.length === 0) {
            // Parent API requires non-empty text when a voice blob is present
            // (e.g. MiniMax). Mobile often has no Web Speech captions.
            combined = "(Voice message)";
          }
          if (combined || imgs.length > 0 || blob.size > 0) {
            onSendRef.current(combined, imgs, blob);
            setInput("");
            setVoiceTranscript("");
            voiceTranscriptRef.current = "";
            setImages([]);
            setRecordedBlob(null);
            setIsPlayingPreview(false);
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
            }
            return;
          }
        }

        setRecordedBlob(blob);
      };

      // 100 ms timeslice: ensures ondataavailable fires regularly so no data is lost
      mediaRecorder.start(100);
      recordingActiveRef.current = true;
      setIsRecording(true);
      setRecordingDuration(0);
      setVoiceTranscript("");
      voiceTranscriptRef.current = "";

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Live dictation while recording — the LLM only sees text; without this,
      // a voice-only send would have an empty user message.
      if (
        "webkitSpeechRecognition" in window ||
        "SpeechRecognition" in window
      ) {
        startSpeechRecognition();
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = sttConfig?.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      voiceTranscriptRef.current = transcript;
      setVoiceTranscript(transcript);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition:", event.error);
      }
    };

    recognition.onend = () => {
      if (!recordingActiveRef.current) return;
      setTimeout(() => {
        if (!recordingActiveRef.current) return;
        const rec = recognitionRef.current;
        if (!rec) return;
        try {
          rec.start();
        } catch {
          /* already started or mic released */
        }
      }, 50);
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("Could not start speech recognition:", e);
    }
  };

  const handleVoiceInputClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleRemoveRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setRecordedBlob(null);
    setIsPlayingPreview(false);
    setVoiceTranscript("");
    voiceTranscriptRef.current = "";
  };

  const togglePreviewPlayback = () => {
    if (!previewAudioRef.current || !recordedBlob) return;

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const handlePreviewEnded = () => {
    setIsPlayingPreview(false);
  };

  // One stable blob URL for preview — inline createObjectURL on every render
  // thrashes the <audio> element and sounds like digital noise.
  useEffect(() => {
    if (!recordedBlob) {
      setPreviewSrc(null);
      return undefined;
    }
    const url = URL.createObjectURL(recordedBlob);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedBlob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const typed = input.trim();
  const spoken = voiceTranscript.trim();
  const hasTextForModel = typed.length > 0 || spoken.length > 0;
  // MiniMax only receives text — a voice clip alone is not enough.
  const canSend = !disabled && (images.length > 0 || hasTextForModel);

  // Calculate character and token counts
  const charCount = input.length;
  const tokenCount = Math.ceil(charCount / 4);

  const getCounterText = () => {
    if (images.length > 0) {
      return `${images.length} image${images.length > 1 ? "s" : ""}`;
    }
    if (charCount > 0) {
      return `${charCount} chars | ~${tokenCount} tokens`;
    }
    return "";
  };

  return (
    <div className="message-input-container">
      {typeof onRealtimeStsToggle === "function" && (
        <RealtimeStsToggle
          enabled={realtimeStsEnabled}
          disabled={disabled}
          onToggle={onRealtimeStsToggle}
        />
      )}
      {images.length > 0 && (
        <div className="image-preview-container">
          {images.map((image, index) => (
            <div key={index} className="image-preview">
              <img src={image.dataUrl} alt={image.name} />
              <button
                type="button"
                className="remove-image-button"
                onClick={() => handleRemoveImage(index)}
                aria-label="Remove image"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 2L10 10M10 2L2 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {voiceTranscript && isRecording && (
        <div className="voice-transcript-preview" aria-live="polite">
          {voiceTranscript}
        </div>
      )}
      {recordedBlob && (
        <div className="audio-preview-container">
          <div className="audio-preview">
            <audio
              ref={previewAudioRef}
              src={previewSrc || undefined}
              onEnded={handlePreviewEnded}
            />
            <button
              type="button"
              className="preview-play-btn"
              onClick={togglePreviewPlayback}
              aria-label={isPlayingPreview ? "Pause preview" : "Play preview"}
            >
              {isPlayingPreview ? (
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
            <div className="preview-info">
              <span className="preview-label">Voice message</span>
              <span className="preview-duration">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <button
              type="button"
              className="remove-audio-button"
              onClick={handleRemoveRecording}
              aria-label="Remove recording"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 2L10 10M10 2L2 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div
        className={`input-wrapper ${isDragging ? "dragging" : ""} ${isRecording ? "recording" : ""} ${realtimeStsEnabled ? "rts-live" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="file-input"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || images.length >= MAX_IMAGES}
          aria-label="Upload image"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M19 10.5V17C19 18.1046 18.1046 19 17 19H5C3.89543 19 3 18.1046 3 17V10.5C3 9.39543 3.89543 8.5 5 8.5H7L8.5 6.5H13.5L15 8.5H17C18.1046 8.5 19 9.39543 19 10.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M7 19V12H15V19"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="11" cy="3.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          type="button"
          className={`voice-input-button ${isRecording ? "recording" : ""}`}
          onClick={handleVoiceInputClick}
          disabled={disabled}
          aria-label={
            isRecording
              ? narrowViewport
                ? "Stop and send voice message"
                : "Stop recording"
              : "Start recording"
          }
        >
          {isRecording ? (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span className="recording-time">
                {formatDuration(recordingDuration)}
              </span>
            </div>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="8" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M6 9C6 12.866 9.13401 16 11 16C14 16 16 12.866 16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M8 18V20M14 18V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 16V17C5 18.6569 6.34315 20 8 20M17 16V17C17 18.6569 15.6569 20 14 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          )}
        </button>
        <textarea
          ref={textareaRef}
          className="message-textarea"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isRecording
              ? "Optional: type while you speak, or rely on live captions…"
              : "Type your message..."
          }
          rows={1}
          disabled={disabled}
        />
        {getCounterText() && (
          <span className="input-counter">{getCounterText()}</span>
        )}
        <button
          className={`send-button ${canSend ? "active" : ""}`}
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 10L17 3L10 17L9 11L3 10Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      </div>
      <p className="input-hint">
        {isRecording ? (
          <span className="recording-hint">
            <span className="recording-pulse"></span>
            Recording — click mic to stop. Your speech is captioned for the
            model (Chrome / Edge).
          </span>
        ) : realtimeStsEnabled ? (
          <span className="rts-hint">
            <span className="rts-hint__dot" aria-hidden />
            Live speech → speech: tap the mic, speak, stop, then send — the
            assistant’s reply is synthesized in your voice (OmniVoice STS).
          </span>
        ) : (
          "Press Enter to send, Shift+Enter for new line"
        )}
      </p>
    </div>
  );
}

export default MessageInput;
