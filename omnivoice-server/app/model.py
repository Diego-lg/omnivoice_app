"""OmniVoice model wrapper for the FastAPI server."""

import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import torch

from omnivoice.models.omnivoice import OmniVoice, OmniVoiceGenerationConfig, VoiceClonePrompt

from .audio import decode_audio_from_base64, tensor_to_audio

logger = logging.getLogger(__name__)


class VoiceProfileStore:
    """In-memory store for voice profiles."""

    def __init__(self):
        self._profiles: dict[str, dict] = {}

    def create_profile(
        self,
        name: str,
        ref_audio: str,
        transcription: Optional[str],
        description: Optional[str],
        model: OmniVoice,
    ) -> dict:
        """Create a new voice profile from reference audio.

        Args:
            name: Profile name.
            ref_audio: Base64-encoded reference audio.
            transcription: Optional transcription.
            description: Optional description.
            model: OmniVoice model instance.

        Returns:
            Voice profile dictionary.
        """
        profile_id = str(uuid.uuid4())

        # Decode and validate audio
        waveform, sr = decode_audio_from_base64(ref_audio)
        audio_tuple = (waveform, sr)

        # Create voice clone prompt
        voice_prompt = model.create_voice_clone_prompt(
            ref_audio=audio_tuple,
            ref_text=transcription,
            preprocess_prompt=True,
        )

        profile = {
            "id": profile_id,
            "name": name,
            "description": description,
            "voice_prompt": voice_prompt,
            "created_at": datetime.utcnow().isoformat(),
        }

        self._profiles[profile_id] = profile
        logger.info(f"Created voice profile: {name} ({profile_id})")
        return self._format_profile(profile)

    def get_profile(self, profile_id: str) -> Optional[dict]:
        """Get a voice profile by ID."""
        profile = self._profiles.get(profile_id)
        if profile is None:
            return None
        return self._format_profile(profile)

    def list_profiles(self) -> list[dict]:
        """List all voice profiles."""
        return [self._format_profile(p) for p in self._profiles.values()]

    def delete_profile(self, profile_id: str) -> bool:
        """Delete a voice profile."""
        if profile_id in self._profiles:
            del self._profiles[profile_id]
            logger.info(f"Deleted voice profile: {profile_id}")
            return True
        return False

    def get_voice_clone_prompt(self, profile_id: str) -> Optional[VoiceClonePrompt]:
        """Get the voice clone prompt for a profile."""
        profile = self._profiles.get(profile_id)
        if profile is None:
            return None
        return profile.get("voice_prompt")

    @staticmethod
    def _format_profile(profile: dict) -> dict:
        """Format profile for API response (without internal data)."""
        return {
            "id": profile["id"],
            "name": profile["name"],
            "description": profile.get("description"),
            "created_at": profile["created_at"],
        }


class OmniVoiceModel:
    """Wrapper class for OmniVoice model with server-friendly interface."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        device: Optional[str] = None,
        load_asr: bool = True,
    ):
        """Initialize the OmniVoice model.

        Args:
            model_path: Path to pretrained model or HuggingFace model ID.
            device: Device to load model on (cuda/mps/cpu). Auto-detected if None.
            load_asr: Whether to load ASR model for auto-transcription.
        """
        self.model_path = model_path or os.environ.get(
            "OMNIVOICE_MODEL_PATH", "k2-fsa/OmniVoice"
        )
        self._device = self._detect_device() if device is None else device
        self._model: Optional[OmniVoice] = None
        self._load_asr = load_asr
        self._voice_store = VoiceProfileStore()

    @staticmethod
    def _detect_device() -> str:
        """Auto-detect the best available device."""
        if torch.cuda.is_available():
            return "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        else:
            return "cpu"

    def load(self):
        """Load the OmniVoice model and tokenizer."""
        logger.info(f"Loading OmniVoice model from {self.model_path} on {self._device}")

        try:
            self._model = OmniVoice.from_pretrained(
                self.model_path,
                device_map=self._device,
                load_asr=self._load_asr,
            )
            self._model.eval()
            logger.info(
                f"Model loaded successfully. Sampling rate: {self._model.sampling_rate}Hz"
            )
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._model is not None

    @property
    def device(self) -> str:
        """Get the device the model is on."""
        if self._model is None:
            return self._device
        return str(self._model.device)

    @property
    def sampling_rate(self) -> int:
        """Get the model's audio sampling rate."""
        if self._model is None:
            return 24000
        return self._model.sampling_rate

    @property
    def voice_store(self) -> VoiceProfileStore:
        """Get the voice profile store."""
        return self._voice_store

    def generate(
        self,
        text: str,
        voice_mode: str = "auto",
        ref_audio: Optional[str] = None,
        ref_text: Optional[str] = None,
        instruct: Optional[str] = None,
        voice_profile_id: Optional[str] = None,
        language: Optional[str] = None,
        speed: float = 1.0,
        duration: Optional[float] = None,
        num_step: int = 32,
        guidance_scale: float = 2.0,
    ) -> np.ndarray:
        """Generate speech audio from text.

        Args:
            text: Text to synthesize.
            voice_mode: Voice mode - 'clone', 'design', or 'auto'.
            ref_audio: Base64-encoded reference audio for cloning.
            ref_text: Transcription of reference audio.
            instruct: Voice design instruction string.
            voice_profile_id: Saved voice profile ID to use.
            language: Language for synthesis.
            speed: Speaking speed factor.
            duration: Fixed output duration in seconds.
            num_step: Number of decoding steps.
            guidance_scale: Guidance scale for generation.

        Returns:
            Generated audio as numpy array.

        Raises:
            RuntimeError: If model is not loaded.
            ValueError: If voice mode is invalid or missing required parameters.
        """
        if self._model is None:
            raise RuntimeError("Model not loaded. Call load() first.")

        # Determine voice clone prompt
        voice_clone_prompt = None
        audio_tuple = None

        if voice_profile_id:
            # Use saved voice profile
            voice_clone_prompt = self._voice_store.get_voice_clone_prompt(voice_profile_id)
            if voice_clone_prompt is None:
                raise ValueError(f"Voice profile not found: {voice_profile_id}")
        elif ref_audio:
            # Create voice prompt from provided reference audio
            waveform, sr = decode_audio_from_base64(ref_audio)
            audio_tuple = (waveform, sr)

        # Build generation config
        gen_config = OmniVoiceGenerationConfig(
            num_step=num_step,
            guidance_scale=guidance_scale,
        )

        # Call model generate
        try:
            audios = self._model.generate(
                text=text,
                language=language,
                ref_text=ref_text,
                ref_audio=audio_tuple,
                voice_clone_prompt=voice_clone_prompt,
                instruct=instruct,
                duration=duration,
                speed=speed,
                generation_config=gen_config,
            )

            if not audios or len(audios) == 0:
                raise RuntimeError("Model generated empty audio output")

            return audios[0]

        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise

    def supported_languages(self) -> list[str]:
        """Get list of supported language IDs."""
        if self._model is None:
            return []
        return sorted(self._model.supported_language_ids())

    def supported_language_names(self) -> list[str]:
        """Get list of supported language names."""
        if self._model is None:
            return []
        return sorted(self._model.supported_language_names())


# Global model instance
_model_instance: Optional[OmniVoiceModel] = None


def get_model() -> OmniVoiceModel:
    """Get the global model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = OmniVoiceModel()
        _model_instance.load()
    return _model_instance


def init_model(
    model_path: Optional[str] = None,
    device: Optional[str] = None,
    load_asr: bool = True,
) -> OmniVoiceModel:
    """Initialize the global model instance.

    Args:
        model_path: Path to pretrained model.
        device: Device to load on.
        load_asr: Whether to load ASR model.

    Returns:
        Initialized OmniVoiceModel instance.
    """
    global _model_instance
    _model_instance = OmniVoiceModel(
        model_path=model_path,
        device=device,
        load_asr=load_asr,
    )
    _model_instance.load()
    return _model_instance
