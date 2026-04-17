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
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.duration * targetSampleRate,
    targetSampleRate,
  );
  offlineContext.renderBuffer(audioBuffer);

  const renderedBuffer = await offlineContext.render();

  // Convert to WAV
  const wavBlob = audioBufferToWav(renderedBuffer);
  audioContext.close();
  return wavBlob;
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
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
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
    response = await fetch(`${baseUrl}/v1/audio/speech`, {
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
    `${baseUrl}/v1/audio/speech/stream`,
  );
  console.log(
    "[streamTextToSpeech] Request body:",
    JSON.stringify(requestBody, null, 2),
  );

  const response = await fetch(`${baseUrl}/v1/audio/speech/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

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

  // Create audio context for decoding
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const reader = response.body.getReader();
  console.log(
    "[streamTextToSpeech] Streaming reader created, waiting for chunks...",
  );

  let chunkIndex = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log(
        "[streamTextToSpeech] Stream complete. Total chunks received:",
        chunkIndex,
      );
      break;
    }

    chunkIndex++;
    console.log(
      "[streamTextToSpeech] Received chunk",
      chunkIndex,
      "with",
      value ? value.length : 0,
      "bytes",
    );

    // Read 4-byte length prefix (big-endian unsigned int)
    const lengthView = new DataView(value.buffer, value.byteOffset, 4);
    const chunkLength = lengthView.getUint32(0, false);
    console.log("[streamTextToSpeech] Chunk payload length:", chunkLength);

    if (chunkLength === 0) {
      // Error signal from server
      console.log("[streamTextToSpeech] Received error marker from server");
      break;
    }

    // Extract audio data after the 4-byte header
    const audioData = new Uint8Array(
      value.buffer,
      value.byteOffset + 4,
      chunkLength,
    );

    try {
      const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
      console.log(
        "[streamTextToSpeech] Decoded chunk",
        chunkIndex,
        "- duration:",
        audioBuffer.duration.toFixed(2),
        "seconds",
      );
      if (onChunk) {
        onChunk(audioBuffer);
      }

      // Play the chunk immediately if callback is provided
      if (onChunk) {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (err) {
      console.error("[streamTextToSpeech] Failed to decode audio chunk:", err);
    }
  }

  audioContext.close();
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
    response = await fetch(`${baseUrl}/v1/voices`, {
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
    response = await fetch(`${baseUrl}/v1/voices`, {
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
    response = await fetch(`${baseUrl}/v1/voices/${id}`, {
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
    response = await fetch(`${baseUrl}/v1/voices/${id}`, {
      method: "DELETE",
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
    response = await fetch(`${baseUrl}/health`, {
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
    response = await fetch(`${baseUrl}/v1/languages`, {
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
  numStep: 32,
  guidanceScale: 2.0,
};
