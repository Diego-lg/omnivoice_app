import { useState, useRef, useCallback } from "react";
import "./MessageInput.css";

const MAX_IMAGES = 4;

function MessageInput({ onSend, disabled }) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
    setRecordedBlob(null);
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 1v10M4 5v6M12 5v6M2 7v4M14 7v4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span>Recorded audio</span>
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
        className={`input-wrapper ${isDragging ? "dragging" : ""}`}
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
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M17 9.5V15.5C17 16.3284 16.3284 17 15.5 17H4.5C3.67157 17 3 16.3284 3 15.5V9.5C3 8.67157 3.67157 8 4.5 8H6.5L8 6H12L13.5 8H15.5C16.3284 8 17 8.67157 17 9.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M7 17V11H13V17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <circle
              cx="10"
              cy="4"
              r="2"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
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
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="4" y="4" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2v4M6 4v3M14 4v3M4 7v4C4 12.5 6.5 15 10 15s6-2.5 6-7V7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M7 16v2M13 16v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <textarea
          ref={textareaRef}
          className="message-textarea"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
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
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

export default MessageInput;
