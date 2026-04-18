import "./RealtimeStsToggle.css";

/**
 * Enables “live” speech-to-speech: voice replies clone your mic take (OmniVoice STS),
 * while assistant text still streams as usual. TTS is turned on automatically when enabled.
 */
function RealtimeStsToggle({ enabled, disabled, onToggle }) {
  return (
    <div className="rts-toggle-wrap">
      <button
        type="button"
        className={`rts-toggle ${enabled ? "rts-toggle--on" : ""}`}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={enabled}
        title={
          enabled
            ? "Live speech-to-speech is on — record with the mic, then send"
            : "Turn on live speech-to-speech (your voice for AI replies)"
        }
      >
        <span className="rts-toggle__glow" aria-hidden />
        <span className="rts-toggle__ring" aria-hidden />
        <span className="rts-toggle__inner">
          <span className="rts-toggle__icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M5 7.5V9a4 4 0 008 0V7.5"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
              <path
                d="M9 12.5v2.5M6.5 15h5"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
              <path
                className="rts-toggle__wave rts-toggle__wave--1"
                d="M12.5 4.5c.8.6 1.2 1.4 1.2 2.3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                className="rts-toggle__wave rts-toggle__wave--2"
                d="M13.8 3.2c1.2.9 1.8 2.2 1.8 3.6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
          </span>
          <span className="rts-toggle__label">
            <span className="rts-toggle__title">Live speech → speech</span>
            <span className="rts-toggle__sub">
              {enabled ? "Use mic + send — AI speaks in your voice" : "Off"}
            </span>
          </span>
          <span className="rts-toggle__pill" aria-hidden>
            <span className="rts-toggle__knob" />
          </span>
        </span>
      </button>
    </div>
  );
}

export default RealtimeStsToggle;
