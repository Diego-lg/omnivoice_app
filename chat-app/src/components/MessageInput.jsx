import { useState, useRef, useCallback, useEffect } from "react";
import "./MessageInput.css";

const MAX_IMAGES = 4;

function MessageInput({ onSend, disabled, sttConfig }) {
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
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const previewAudioRef = useRef(null);
  const recognitionRef = useRef(null);

  const handleSubmit = useCallback(() => {
    if ((input.trim() || images.length > 0 || recordedBlob) && !disabled) {
      onSend(input, images, recordedBlob);
      setInput("");
      setImages([]);
      setRecordedBlob(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [input, images, recordedBlob, disabled, onSend]);

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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Start speech recognition if available and configured
      if (
        sttConfig?.continuous &&
        ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
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

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = sttConfig?.language || "en-US";
    recognitionRef.current.continuous = sttConfig?.continuous || false;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput((prev) => prev + transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current.start();
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopSpeechRecognition();

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
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

  const canSend =
    (input.trim().length > 0 || images.length > 0 || recordedBlob) && !disabled;

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
      {recordedBlob && (
        <div className="audio-preview-container">
          <div className="audio-preview">
            <audio
              ref={previewAudioRef}
              src={URL.createObjectURL(recordedBlob)}
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
        className={`input-wrapper ${isDragging ? "dragging" : ""} ${isRecording ? "recording" : ""}`}
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
          aria-label={isRecording ? "Stop recording" : "Start recording"}
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
          placeholder={isRecording ? "Recording..." : "Type your message..."}
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
            Recording... Click microphone to stop
          </span>
        ) : (
          "Press Enter to send, Shift+Enter for new line"
        )}
      </p>
    </div>
  );
}

export default MessageInput;
