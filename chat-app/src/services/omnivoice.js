/**
 * OmniVoice TTS Service
 *
 * Frontend service for communicating with the OmniVoice FastAPI backend.
 * Supports text-to-speech, voice cloning, and voice profile management.
 */

// Use relative URLs to leverage Vite proxy in development
// The proxy in vite.config.js forwards /v1/* and /health to http://localhost:8005
const OMNIVOICE_BASE_URL = "";

/**
 * OmniVoice HTTP root (no trailing slash). Empty = same origin / Vite proxy.
 * Set in Settings → Voice, or `VITE_OMNIVOICE_API_URL` (e.g. http://YOUR-LAN-IP:8005 for Android).
 * @param {Record<string, unknown>|null|undefined} config
 */
export function getOmnivoiceBaseUrl(config) {
  const fromConfig =
    config &&
    typeof config.omnivoiceBaseUrl === "string" &&
    config.omnivoiceBaseUrl.trim();
  if (fromConfig) return fromConfig.replace(/\/$/, "");
  const env =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_OMNIVOICE_API_URL
      ? String(import.meta.env.VITE_OMNIVOICE_API_URL).trim()
      : "";
  if (env) return env.replace(/\/$/, "");
  return "";
}

/** Strip trailing slashes and a trailing `/v1` so paths never become `/v1/v1/...`. */
function normalizeOmnivoiceFetchRoot(raw) {
  let root = String(raw ?? "").trim();
  if (!root) return "";
  root = root.replace(/\/+$/, "");
  while (/\/v1$/.test(root)) {
    root = root.replace(/\/v1$/, "").replace(/\/+$/, "");
  }
  return root;
}

function resolveOmnivoiceFetchUrl(path, baseUrl = OMNIVOICE_BASE_URL) {
  const root = normalizeOmnivoiceFetchRoot(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!root) return p;
  return `${root}${p}`;
}

/**
 * Convert an ArrayBuffer to a Base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string to an ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert audio Blob to Base64 string
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resample audio to target sample rate using Web Audio API
 * @param {Blob} blob - Audio blob to resample
 * @param {number} targetSampleRate - Target sample rate (default 24000)
 * @returns {Promise<Blob>} Resampled audio as WAV Blob
 */
async function resampleAudio(blob, targetSampleRate = 24000) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const frameCount = Math.max(
    1,
    Math.ceil(audioBuffer.duration * targetSampleRate),
  );
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    frameCount,
    targetSampleRate,
  );
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  audioContext.close();
  return audioBufferToWav(renderedBuffer);
}

/**
 * Convert AudioBuffer to WAV Blob
 * @param {AudioBuffer} buffer
 * @returns {Blob}
 */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Mix down to mono so sentence chunks with different channel layouts stitch
 * correctly in OfflineAudioContext.
 */
function toMonoAudioBuffer(buffer) {
  if (buffer.numberOfChannels === 1) return buffer;
  const { length, sampleRate, numberOfChannels } = buffer;
  const oac = new OfflineAudioContext(1, length, sampleRate);
  const mono = oac.createBuffer(1, length, sampleRate);
  const out = mono.getChannelData(0);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numberOfChannels; c++) {
      sum += buffer.getChannelData(c)[i];
    }
    out[i] = sum / numberOfChannels;
  }
  return mono;
}

/**
 * Check audio sample rate using Web Audio API
 * Returns the sample rate or null if unable to determine
 * @param {Blob} blob
 * @returns {Promise<number|null>}
 */
async function getAudioSampleRate(blob) {
  try {
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = audioBuffer.sampleRate;
    audioContext.close();
    return sampleRate;
  } catch {
    return null;
  }
}

/**
 * Validate that audio is at the correct sample rate (24000Hz)
 * @param {Blob} blob
 * @throws {Error} If sample rate is invalid
 */
async function validateAudioSampleRate(blob) {
  const sampleRate = await getAudioSampleRate(blob);
  if (sampleRate !== null && sampleRate !== 24000) {
    throw new Error(
      `Invalid audio sample rate: ${sampleRate}Hz. OmniVoice requires 24000Hz audio. ` +
        `Please resample your audio to 24kHz using a tool like Audacity or ffmpeg.`,
    );
  }
}

/**
 * Resample audio and convert to Base64
 * Returns both the resampled blob (for later validation) and base64 string
 * @param {Blob} blob
 * @returns {Promise<{blob: Blob, base64: string}>}
 */
async function resampleAudioToBase64(blob) {
  const resampledBlob = await resampleAudio(blob, 24000);
  const base64 = await blobToBase64(resampledBlob);
  return { blob: resampledBlob, base64 };
}

/**
 * Transcribe audio using the Web Speech API (browser fallback)
 * @param {Blob} audioBlob
 * @returns {Promise<string>}
 */
async function transcribeWithWebSpeech(audioBlob) {
  return new Promise((resolve, reject) => {
    const recognition = new (
      window.SpeechRecognition || window.webkitSpeechRecognition
    )();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Convert blob to audio element for playback
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    recognition.onresult = (event) => {
      URL.revokeObjectURL(audioUrl);
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event) => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    // Auto-start recognition when audio loads
    audio.onloadedmetadata = () => {
      recognition.start();
      audio.play().catch(reject);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error("Failed to load audio for transcription"));
    };
  });
}

/**
 * Text-to-Speech synthesis
 *
 * @param {string} text - Text to synthesize
 * @param {Object} options - Synthesis options
 * @param {string} options.voice - Voice mode: "clone" | "design" | "auto"
 * @param {Object} options.voiceConfig - Voice configuration
 * @param {string} [options.voiceConfig.refAudio] - Base64 reference audio for clone mode
 * @param {string} [options.voiceConfig.refText] - Transcription of reference audio
 * @param {string} [options.voiceConfig.instruct] - Voice design instruction (e.g., "male, british accent")
 * @param {Object} options.generationConfig - Generation configuration
 * @param {string} [options.generationConfig.language] - Language for synthesis
 * @param {number} [options.generationConfig.speed] - Speaking speed (default: 1.0)
 * @param {number} [options.generationConfig.duration] - Fixed duration in seconds
 * @param {number} [options.generationConfig.numStep] - Decoding steps (default: 32)
 * @param {number} [options.generationConfig.guidanceScale] - CFG scale (default: 2.0)
 * @param {string} [options.voiceProfileId] - Voice profile ID to use
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<{audioBlob: Blob, audioUrl: string}>}
 */
export async function textToSpeech(
  text,
  options = {},
  baseUrl = OMNIVOICE_BASE_URL,
) {
  const {
    voice = "auto",
    voiceConfig = {},
    generationConfig = {},
    voiceProfileId = null,
  } = options;

  // Validate voice mode requirements
  if (voice === "design" && !voiceConfig.instruct) {
    throw new Error(
      "Voice mode 'design' requires an instruction description (e.g., 'male, british accent'). Please provide a voice description in settings.",
    );
  }

  // Validate clone mode has reference audio
  if (voice === "clone" && !voiceConfig.refAudio) {
    throw new Error(
      "Voice mode 'clone' requires reference audio. Please upload a clear audio sample (24kHz WAV recommended, 10-60 seconds).",
    );
  }

  // Build request body following OpenAI /v1/audio/speech format
  const requestBody = {
    input: text,
    model: "omnivoice",
    voice: voice,
    voice_config: {
      ref_audio: voiceConfig.refAudio || null,
      ref_text: voiceConfig.refText || null,
      instruct: voiceConfig.instruct || null,
    },
    generation_config: {
      language: generationConfig.language || null,
      speed: generationConfig.speed ?? 1.0,
      duration: generationConfig.duration || null,
      num_step: generationConfig.numStep ?? 32,
      guidance_scale: generationConfig.guidanceScale ?? 2.0,
    },
  };

  // Add voice profile ID if provided
  if (voiceProfileId) {
    requestBody.voice_profile_id = voiceProfileId;
  }

  let response;
  try {
    response = await fetch(resolveOmnivoiceFetchUrl("/v1/audio/speech", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.error || errorDetail;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`TTS request failed: ${errorDetail}`);
  }

  // Get audio as blob
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return { audioBlob, audioUrl };
}

/**
 * Stream text-to-speech with progressive audio playback.
 *
 * @param {string} text - Text to synthesize
 * @param {Object} options - Synthesis options (same as textToSpeech)
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @param {Function} onChunk - Callback for each audio chunk: (audioBuffer: AudioBuffer) => void
 * @returns {Promise<void>}
 */
export async function streamTextToSpeech(
  text,
  options = {},
  baseUrl = OMNIVOICE_BASE_URL,
  onChunk = null,
) {
  const {
    voice = "auto",
    voiceConfig = {},
    generationConfig = {},
    voiceProfileId = null,
    audioContext: providedAudioContext = null,
  } = options;

  // Validate voice mode requirements
  if (voice === "design" && !voiceConfig.instruct) {
    throw new Error(
      "Voice mode 'design' requires an instruction description (e.g., 'male, british accent'). Please provide a voice description in settings.",
    );
  }

  if (voice === "clone" && !voiceConfig.refAudio) {
    throw new Error(
      "Voice mode 'clone' requires reference audio. Please upload a clear audio sample (24kHz WAV recommended, 10-60 seconds).",
    );
  }

  // Build request body
  const requestBody = {
    input: text,
    model: "omnivoice",
    voice: voice,
    voice_config: {
      ref_audio: voiceConfig.refAudio || null,
      ref_text: voiceConfig.refText || null,
      instruct: voiceConfig.instruct || null,
    },
    generation_config: {
      language: generationConfig.language || null,
      speed: generationConfig.speed ?? 1.0,
      duration: generationConfig.duration || null,
      num_step: generationConfig.numStep ?? 32,
      guidance_scale: generationConfig.guidanceScale ?? 2.0,
    },
  };

  if (voiceProfileId) {
    requestBody.voice_profile_id = voiceProfileId;
  }

  console.log(
    "[streamTextToSpeech] Sending streaming TTS request to:",
    resolveOmnivoiceFetchUrl("/v1/audio/speech/stream", baseUrl),
  );
  console.log(
    "[streamTextToSpeech] Request body:",
    JSON.stringify(requestBody, null, 2),
  );

  const response = await fetch(
    resolveOmnivoiceFetchUrl("/v1/audio/speech/stream", baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  console.log(
    "[streamTextToSpeech] Response status:",
    response.status,
    response.ok ? "OK" : "FAILED",
  );

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.error || errorDetail;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`Streaming TTS request failed: ${errorDetail}`);
  }

  // Prefer a pre-running AudioContext passed from the call site (created during
  // a user gesture). Falling back to a fresh context risks "suspended" state
  // which silently blocks all scheduled audio.
  const ownsContext = !providedAudioContext;
  const audioContext =
    providedAudioContext ||
    new (window.AudioContext || window.webkitAudioContext)();

  // Ensure the context is running before scheduling any audio.
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      console.warn("[streamTextToSpeech] Could not resume AudioContext.");
    }
  }

  const reader = response.body.getReader();
  console.log("[streamTextToSpeech] Reader ready, waiting for sentence chunks…");

  let buffer = new Uint8Array(0);

  const appendBuffer = (incoming) => {
    const merged = new Uint8Array(buffer.length + incoming.length);
    merged.set(buffer, 0);
    merged.set(incoming, buffer.length);
    buffer = merged;
  };

  let nextStartTime = audioContext.currentTime;
  let chunkIndex = 0;
  const collectedBuffers = [];

  const decodeAndSchedule = async (frameBytes) => {
    const copy = frameBytes.buffer.slice(
      frameBytes.byteOffset,
      frameBytes.byteOffset + frameBytes.byteLength,
    );
    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
    let audioBuffer;
    try {
      if (decodeCtx.state === "suspended") {
        await decodeCtx.resume().catch(() => {});
      }
      // Fresh context per chunk avoids Chromium decodeAudioData corruption when
      // decoding many sequential WAV payloads on one AudioContext.
      audioBuffer = await decodeCtx.decodeAudioData(copy.slice(0));
    } catch (err) {
      console.error("[streamTextToSpeech] Decode failed for chunk", chunkIndex, err);
      return;
    } finally {
      try {
        decodeCtx.close();
      } catch {
        /* ignore */
      }
    }

    chunkIndex++;
    console.log(
      `[streamTextToSpeech] Sentence ${chunkIndex}: ${audioBuffer.duration.toFixed(2)}s`,
    );

    collectedBuffers.push(audioBuffer);
    if (onChunk) {
      onChunk(audioBuffer);
    }

    // After async LLM + network work the shared context is often "suspended"
    // again — scheduled buffers are silent until we resume.
    if (audioContext.state !== "running") {
      try {
        await audioContext.resume();
      } catch {
        console.warn("[streamTextToSpeech] Could not resume playback context.");
      }
    }

    const startAt = Math.max(nextStartTime, audioContext.currentTime);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(startAt);
    nextStartTime = startAt + audioBuffer.duration;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    appendBuffer(value);

    while (buffer.length >= 4) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
      const frameLen = view.getUint32(0, false);

      if (frameLen === 0) {
        console.warn("[streamTextToSpeech] Server sent error sentinel.");
        if (ownsContext) {
          try {
            audioContext.close();
          } catch {
            /* ignore */
          }
        }
        return { audioBlob: null, audioUrl: null };
      }

      if (buffer.length < 4 + frameLen) {
        break;
      }

      const frameBytes = buffer.slice(4, 4 + frameLen);
      buffer = buffer.slice(4 + frameLen);

      await decodeAndSchedule(frameBytes);
    }
  }

  console.log(
    `[streamTextToSpeech] Stream complete. Total sentences: ${chunkIndex}`,
  );

  const combinePromise = combineAudioBuffers(collectedBuffers);

  const remaining = nextStartTime - audioContext.currentTime;
  if (remaining > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, remaining * 1000 + 300),
    );
  }

  if (ownsContext) {
    try {
      audioContext.close();
    } catch {
      /* ignore */
    }
  }

  const audioBlob = await combinePromise;
  const audioUrl = URL.createObjectURL(audioBlob);
  return { audioBlob, audioUrl };
}

/**
 * Combine multiple AudioBuffers into a single WAV Blob for replay.
 * Uses OfflineAudioContext to render all buffers sequentially.
 * @param {AudioBuffer[]} buffers
 * @returns {Promise<Blob>}
 */
async function combineAudioBuffers(buffers) {
  if (buffers.length === 0) return new Blob([], { type: "audio/wav" });
  const monoBuffers = buffers.map(toMonoAudioBuffer);
  if (monoBuffers.length === 1) return audioBufferToWav(monoBuffers[0]);

  const sampleRate = monoBuffers[0].sampleRate;
  const totalLength = monoBuffers.reduce((sum, b) => sum + b.length, 0);
  const offlineCtx = new OfflineAudioContext(1, totalLength, sampleRate);

  let offsetSec = 0;
  for (const buf of monoBuffers) {
    if (buf.sampleRate !== sampleRate) {
      console.warn(
        "[combineAudioBuffers] Sample rate mismatch; replay may be corrupted",
      );
    }
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    source.connect(offlineCtx.destination);
    source.start(offsetSec);
    offsetSec += buf.duration;
  }

  const rendered = await offlineCtx.startRendering();
  return audioBufferToWav(rendered);
}

/**
 * Speech-to-Speech synthesis using voice clone
 *
 * Transcribes the input audio first, then synthesizes with voice cloning.
 *
 * @param {Blob} audioBlob - Input audio blob (will be transcribed)
 * @param {string} text - Text to synthesize (optional, uses transcript if not provided)
 * @param {Object} options - Synthesis options (same as textToSpeech)
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<{audioBlob: Blob, audioUrl: string, transcript: string}>}
 */
export async function speechToSpeech(
  audioBlob,
  text = null,
  options = {},
  baseUrl = OMNIVOICE_BASE_URL,
) {
  // Check sample rate and auto-resample to 24kHz if needed
  const sampleRate = await getAudioSampleRate(audioBlob);
  let processedBlob = audioBlob;

  if (sampleRate !== null && sampleRate !== 24000) {
    console.log(`Resampling audio from ${sampleRate}Hz to 24000Hz`);
    processedBlob = await resampleAudio(audioBlob, 24000);
  }

  // First, transcribe the input audio
  let transcript = text;

  if (!transcript) {
    try {
      transcript = await transcribeWithWebSpeech(processedBlob);
    } catch (err) {
      throw new Error(`Transcription failed: ${err.message}`);
    }
  }

  // Get base64 of the reference audio
  let refAudioBase64;
  try {
    refAudioBase64 = await blobToBase64(processedBlob);
  } catch (err) {
    throw new Error(`Failed to encode reference audio: ${err.message}`);
  }

  // Synthesize with voice clone
  const result = await textToSpeech(
    transcript,
    {
      ...options,
      voice: "clone",
      voiceConfig: {
        ...options.voiceConfig,
        refAudio: refAudioBase64,
        refText: transcript,
      },
    },
    baseUrl,
  );

  return {
    ...result,
    transcript,
  };
}

/**
 * Transcribe a recorded voice clip via OmniVoice server Whisper ASR.
 * Prefers 24kHz WAV from the browser; if decode/resample fails (some Android WebM),
 * sends raw bytes + mime_type so the server can decode with torchaudio.
 *
 * @param {Blob} audioBlob
 * @param {string} [baseUrl] - From {@link getOmnivoiceBaseUrl}; empty = same-origin / Vite proxy
 * @returns {Promise<string>} Non-empty transcript text
 */
export async function transcribeVoiceBlob(
  audioBlob,
  baseUrl = OMNIVOICE_BASE_URL,
) {
  let file;
  let mimeType =
    audioBlob.type && audioBlob.type !== "application/octet-stream"
      ? audioBlob.type
      : "audio/webm";

  try {
    const wavBlob = await resampleAudio(audioBlob, 24000);
    file = await blobToBase64(wavBlob);
    mimeType = "audio/wav";
  } catch (err) {
    console.warn(
      "[transcribeVoiceBlob] Client WAV conversion failed; sending raw to server:",
      err?.message || err,
    );
    file = await blobToBase64(audioBlob);
  }

  let response;
  try {
    response = await fetch(
      resolveOmnivoiceFetchUrl("/v1/audio/transcriptions", baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, mime_type: mimeType }),
      },
    );
  } catch (err) {
    throw new Error(
      `Could not reach OmniVoice for transcription (${err.message}). Is the server running (e.g. port 8005)?`,
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      detail = errJson.detail || errJson.error || detail;
    } catch {
      try {
        detail = (await response.text()).slice(0, 200) || detail;
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail);
  }

  const data = await response.json();
  const text = (data.text || "").trim();
  if (!text) {
    throw new Error("Transcription returned empty text.");
  }
  return text;
}

/**
 * Create a voice profile from reference audio
 *
 * @param {Blob} refAudio - Reference audio blob (24kHz WAV recommended)
 * @param {string} name - Name for the voice profile
 * @param {string} [description] - Optional description
 * @param {string} [transcription] - Optional transcription of the reference audio
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<{id: string, name: string, description: string, created_at: string}>}
 */
export async function createVoiceProfile(
  refAudio,
  name,
  description = null,
  transcription = null,
  baseUrl = OMNIVOICE_BASE_URL,
) {
  // Convert audio blob to base64
  let audioBase64;
  try {
    audioBase64 = await blobToBase64(refAudio);
  } catch (err) {
    throw new Error(`Failed to encode audio: ${err.message}`);
  }

  const requestBody = {
    name,
    audio: audioBase64,
    transcription: transcription,
    description: description,
  };

  let response;
  try {
    response = await fetch(resolveOmnivoiceFetchUrl("/v1/voices", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.error || errorDetail;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`Voice profile creation failed: ${errorDetail}`);
  }

  return response.json();
}

/**
 * Get all saved voice profiles
 *
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<Array<{id: string, name: string, description: string, created_at: string}>>}
 */
export async function getVoiceProfiles(baseUrl = OMNIVOICE_BASE_URL) {
  let response;
  try {
    response = await fetch(resolveOmnivoiceFetchUrl("/v1/voices", baseUrl), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.error || errorDetail;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`Failed to fetch voice profiles: ${errorDetail}`);
  }

  const data = await response.json();
  return data.voices || [];
}

/**
 * Get a specific voice profile by ID
 *
 * @param {string} id - Voice profile ID
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<{id: string, name: string, description: string, created_at: string}>}
 */
export async function getVoiceProfile(id, baseUrl = OMNIVOICE_BASE_URL) {
  let response;
  try {
    response = await fetch(
      resolveOmnivoiceFetchUrl(`/v1/voices/${id}`, baseUrl),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.error || errorDetail;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`Failed to fetch voice profile: ${errorDetail}`);
  }

  return response.json();
}

/**
 * Delete a voice profile
 *
 * @param {string} id - Voice profile ID to delete
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<void>}
 */
export async function deleteVoiceProfile(id, baseUrl = OMNIVOICE_BASE_URL) {
  let response;
  try {
    response = await fetch(
      resolveOmnivoiceFetchUrl(`/v1/voices/${id}`, baseUrl),
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.error || errorDetail;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`Failed to delete voice profile: ${errorDetail}`);
  }
}

/**
 * Check server health status
 *
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<{status: string, model_loaded: boolean, device: string, sampling_rate: number}>}
 */
export async function checkHealth(baseUrl = OMNIVOICE_BASE_URL) {
  let response;
  try {
    response = await fetch(resolveOmnivoiceFetchUrl("/health", baseUrl), {
      method: "GET",
    });
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get supported languages
 *
 * @param {string} [baseUrl] - Base URL of the OmniVoice server
 * @returns {Promise<{language_ids: string[], language_names: string[]}>}
 */
export async function getSupportedLanguages(baseUrl = OMNIVOICE_BASE_URL) {
  let response;
  try {
    response = await fetch(resolveOmnivoiceFetchUrl("/v1/languages", baseUrl), {
      method: "GET",
    });
  } catch (err) {
    throw new Error(
      `Network error: ${err.message}. Make sure OmniVoice server is running on ${baseUrl}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch languages: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Voice mode constants for convenience
 */
export const VOICE_MODES = {
  CLONE: "clone",
  DESIGN: "design",
  AUTO: "auto",
};

/**
 * Default generation config
 */
export const DEFAULT_GENERATION_CONFIG = {
  language: null,
  speed: 1.0,
  duration: null,
  numStep: 48,
  guidanceScale: 2.25,
};
