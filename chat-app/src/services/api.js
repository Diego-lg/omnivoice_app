import * as minimax from "./minimax.js";
import * as omnivoice from "./omnivoice.js";

export { minimax, omnivoice };
export { MINIMAX_MODELS } from "./minimax.js";
export {
  VOICE_MODES,
  DEFAULT_GENERATION_CONFIG,
  textToSpeech,
  streamTextToSpeech,
  speechToSpeech,
  createVoiceProfile,
  getVoiceProfiles,
  getVoiceProfile,
  deleteVoiceProfile,
  checkHealth,
  getSupportedLanguages,
} from "./omnivoice.js";
