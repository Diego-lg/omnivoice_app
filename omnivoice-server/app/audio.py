"""Audio processing utilities for the OmniVoice API."""

import base64
import io
from typing import Optional

import numpy as np
import soundfile as sf
import torch


def encode_audio_to_base64(audio: np.ndarray, sampling_rate: int) -> str:
    """Encode numpy audio array to base64 string.

    Args:
        audio: Audio waveform as numpy array.
        sampling_rate: Sample rate of the audio.

    Returns:
        Base64-encoded WAV audio string.
    """
    buffer = io.BytesIO()
    sf.write(buffer, audio, sampling_rate, format="WAV")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def decode_audio_from_base64(
    audio_b64: str, expected_sampling_rate: int = 24000
) -> tuple[np.ndarray, int]:
    """Decode base64-encoded audio to numpy array.

    Args:
        audio_b64: Base64-encoded audio string.
        expected_sampling_rate: Expected sample rate for validation.

    Returns:
        Tuple of (audio waveform as numpy array, sample rate).

    Raises:
        ValueError: If audio cannot be decoded or has wrong sample rate.
    """
    try:
        audio_bytes = base64.b64decode(audio_b64)
        buffer = io.BytesIO(audio_bytes)
        waveform, sr = sf.read(buffer, dtype=np.float32)
    except Exception as e:
        raise ValueError(f"Failed to decode audio from base64: {e}")

    # Validate sample rate
    if sr != expected_sampling_rate:
        raise ValueError(
            f"Invalid sample rate: {sr}Hz. Expected {expected_sampling_rate}Hz. "
            f"Please resample your audio to {expected_sampling_rate}Hz."
        )

    # Ensure mono channel
    if waveform.ndim > 1:
        waveform = np.mean(waveform, axis=1)

    # Normalize to [-1, 1] if needed
    max_val = np.abs(waveform).max()
    if max_val > 1.0:
        waveform = waveform / max_val

    return waveform, sr


def audio_to_tensor(
    audio: np.ndarray, device: str = "cpu"
) -> tuple[torch.Tensor, int]:
    """Convert numpy array to torch tensor for model input.

    Args:
        audio: Audio waveform as numpy array.
        device: Target device for the tensor.

    Returns:
        Tuple of (audio tensor [1, T], sample rate).
    """
    tensor = torch.from_numpy(audio).float()
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    return tensor.to(device), 24000


def tensor_to_audio(tensor: torch.Tensor) -> np.ndarray:
    """Convert torch tensor to numpy array.

    Args:
        tensor: Audio tensor [1, T] or [T].

    Returns:
        Audio waveform as numpy array.
    """
    audio = tensor.cpu().numpy()
    if audio.ndim > 1:
        audio = audio.squeeze()
    return audio


def validate_audio_quality(audio: np.ndarray, sample_rate: int) -> dict:
    """Analyze audio quality metrics.

    Args:
        audio: Audio waveform.
        sample_rate: Sample rate.

    Returns:
        Dictionary with quality metrics.
    """
    rms = float(np.sqrt(np.mean(audio ** 2)))
    peak = float(np.abs(audio).max())
    duration = len(audio) / sample_rate

    # Check for clipping
    clipped_samples = np.sum(np.abs(audio) >= 0.99)
    clipping_ratio = float(clipped_samples / len(audio)) if len(audio) > 0 else 0

    return {
        "duration_seconds": duration,
        "rms": rms,
        "peak": peak,
        "clipping_ratio": clipping_ratio,
        "is_too_quiet": rms < 0.01,
        "is_clipped": clipping_ratio > 0.01,
    }
