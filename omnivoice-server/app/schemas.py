"""Pydantic schemas for the OmniVoice API."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class VoiceMode(str, Enum):
    """Voice generation mode."""

    CLONE = "clone"
    DESIGN = "design"
    AUTO = "auto"


class GenerationConfig(BaseModel):
    """Configuration for audio generation."""

    language: Optional[str] = Field(
        default=None,
        description="Language for synthesis (e.g., 'English', 'Chinese'). None for auto-detect.",
    )
    speed: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Speaking speed factor. > 1.0 faster, < 1.0 slower.",
    )
    duration: Optional[float] = Field(
        default=None,
        gt=0,
        description="Fixed output duration in seconds. Overrides speed if set.",
    )
    num_step: int = Field(
        default=32,
        ge=1,
        le=100,
        description="Number of decoding steps. 16=faster, 32=better quality.",
    )
    guidance_scale: float = Field(
        default=2.0,
        ge=0.0,
        le=10.0,
        description="Classifier-free guidance scale.",
    )


class VoiceConfig(BaseModel):
    """Configuration for voice selection/style."""

    ref_audio: Optional[str] = Field(
        default=None,
        description="Base64-encoded reference audio for voice cloning.",
    )
    ref_text: Optional[str] = Field(
        default=None,
        description="Transcription of the reference audio.",
    )
    instruct: Optional[str] = Field(
        default=None,
        description="Voice design instruction (e.g., 'male, british accent').",
    )


class SpeechRequest(BaseModel):
    """Request body for the /v1/audio/speech endpoint (OpenAI-compatible)."""

    input: str = Field(..., description="Text to synthesize.")
    model: str = Field(default="omnivoice", description="Model identifier.")
    voice: str = Field(
        default="auto",
        description="Voice mode: 'clone', 'design', or 'auto'.",
    )
    voice_config: VoiceConfig = Field(
        default_factory=VoiceConfig,
        description="Voice configuration.",
    )
    generation_config: GenerationConfig = Field(
        default_factory=GenerationConfig,
        description="Generation configuration.",
    )


class CreateVoiceRequest(BaseModel):
    """Request to create a voice profile from reference audio."""

    name: str = Field(..., description="Name for the voice profile.")
    audio: str = Field(..., description="Base64-encoded reference audio (24kHz WAV).")
    transcription: Optional[str] = Field(
        default=None,
        description="Transcription of the reference audio. Auto-transcribed if not provided.",
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description of the voice.",
    )


class VoiceProfile(BaseModel):
    """A saved voice profile."""

    id: str = Field(..., description="Unique voice profile ID.")
    name: str = Field(..., description="Name of the voice profile.")
    description: Optional[str] = Field(default=None, description="Description.")
    created_at: str = Field(..., description="ISO timestamp of creation.")


class VoiceProfileList(BaseModel):
    """List of voice profiles."""

    voices: list[VoiceProfile]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    model_loaded: bool
    device: str
    sampling_rate: Optional[int] = None


class ErrorResponse(BaseModel):
    """Error response."""

    error: str
    detail: Optional[str] = None
