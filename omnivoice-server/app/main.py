"""FastAPI application for OmniVoice TTS server."""

import asyncio
import io
import logging
import os
import struct
from contextlib import asynccontextmanager

import soundfile as sf
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .audio import encode_audio_to_base64
from .model import get_model, init_model
from .schemas import (
    CreateVoiceRequest,
    ErrorResponse,
    HealthResponse,
    SpeechRequest,
    VoiceMode,
    VoiceProfile,
    VoiceProfileList,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    model_path = os.environ.get("OMNIVOICE_MODEL_PATH")
    device = os.environ.get("OMNIVOICE_DEVICE")
    load_asr = os.environ.get("OMNIVOICE_LOAD_ASR", "true").lower() == "true"

    logger.info("Starting OmniVoice server...")
    logger.info(f"Model path: {model_path or 'default'}")
    logger.info(f"Device: {device or 'auto-detect'}")
    logger.info(f"Load ASR: {load_asr}")

    try:
        init_model(model_path=model_path, device=device, load_asr=load_asr)
        logger.info("OmniVoice model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        # Don't raise - allow server to start for health check

    yield

    # Shutdown
    logger.info("Shutting down OmniVoice server...")


app = FastAPI(
    title="OmniVoice TTS API",
    description="REST API for OmniVoice text-to-speech synthesis",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    model = get_model()
    return HealthResponse(
        status="healthy" if model.is_loaded else "degraded",
        model_loaded=model.is_loaded,
        device=model.device,
        sampling_rate=model.sampling_rate if model.is_loaded else None,
    )


@app.post("/v1/audio/speech")
async def synthesize_speech(request: SpeechRequest) -> Response:
    """Generate speech audio from text.

    This endpoint follows the OpenAI /v1/audio/speech API format.

    Args:
        request: Speech synthesis request.

    Returns:
        Audio file response (WAV format).
    """
    model = get_model()

    if not model.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Check server logs.",
        )

    # Validate voice mode and parameters
    voice_mode = VoiceMode(request.voice.lower())
    ref_audio = None
    ref_text = None
    instruct = None
    voice_profile_id = None

    if voice_mode == VoiceMode.CLONE:
        if request.voice_config.ref_audio:
            ref_audio = request.voice_config.ref_audio
            ref_text = request.voice_config.ref_text
        else:
            raise HTTPException(
                status_code=400,
                detail="Voice mode 'clone' requires ref_audio in voice_config",
            )
    elif voice_mode == VoiceMode.DESIGN:
        if request.voice_config.instruct:
            instruct = request.voice_config.instruct
        else:
            raise HTTPException(
                status_code=400,
                detail="Voice mode 'design' requires instruct in voice_config",
            )
    elif voice_mode == VoiceMode.AUTO:
        # Auto mode - no additional parameters needed
        pass

    try:
        # Generate audio
        audio = model.generate(
            text=request.input,
            voice_mode=request.voice,
            ref_audio=ref_audio,
            ref_text=ref_text,
            instruct=instruct,
            voice_profile_id=voice_profile_id,
            language=request.generation_config.language,
            speed=request.generation_config.speed,
            duration=request.generation_config.duration,
            num_step=request.generation_config.num_step,
            guidance_scale=request.generation_config.guidance_scale,
        )

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, model.sampling_rate, format="WAV")
        buffer.seek(0)
        audio_bytes = buffer.read()

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav",
                "X-Sampling-Rate": str(model.sampling_rate),
            },
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@app.post("/v1/audio/speech/stream")
async def synthesize_speech_stream(request: SpeechRequest):
    """Generate speech audio from text with true sentence-level streaming.

    The input text is split into sentence chunks. Audio for each chunk is
    yielded as soon as it finishes generating, so the client can begin
    playback before the full text has been synthesised.

    Each yielded frame is length-prefixed: 4 bytes big-endian uint32
    followed by that many bytes of WAV audio data. A 4-byte zero signals
    an error and terminates the stream.

    Args:
        request: Speech synthesis request.

    Returns:
        Streaming response (application/octet-stream, framed WAV chunks).
    """
    model = get_model()

    if not model.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Check server logs.",
        )

    voice_mode = VoiceMode(request.voice.lower())
    ref_audio = None
    ref_text = None
    instruct = None
    voice_profile_id = None

    if voice_mode == VoiceMode.CLONE:
        if request.voice_config.ref_audio:
            ref_audio = request.voice_config.ref_audio
            ref_text = request.voice_config.ref_text
        else:
            raise HTTPException(
                status_code=400,
                detail="Voice mode 'clone' requires ref_audio in voice_config",
            )
    elif voice_mode == VoiceMode.DESIGN:
        if request.voice_config.instruct:
            instruct = request.voice_config.instruct
        else:
            raise HTTPException(
                status_code=400,
                detail="Voice mode 'design' requires instruct in voice_config",
            )

    async def audio_stream_generator():
        loop = asyncio.get_event_loop()
        # Small queue to backpressure the generation thread if the client is slow
        queue: asyncio.Queue = asyncio.Queue(maxsize=4)

        def _generate_blocking():
            """Runs in a thread pool; puts (kind, value) tuples onto the queue."""
            try:
                for audio in model.generate_stream_sentences(
                    text=request.input,
                    voice_mode=request.voice,
                    ref_audio=ref_audio,
                    ref_text=ref_text,
                    instruct=instruct,
                    voice_profile_id=voice_profile_id,
                    language=request.generation_config.language,
                    speed=request.generation_config.speed,
                    num_step=request.generation_config.num_step,
                    guidance_scale=request.generation_config.guidance_scale,
                ):
                    asyncio.run_coroutine_threadsafe(
                        queue.put(("chunk", audio)), loop
                    ).result()
                asyncio.run_coroutine_threadsafe(
                    queue.put(("done", None)), loop
                ).result()
            except Exception as exc:
                asyncio.run_coroutine_threadsafe(
                    queue.put(("error", exc)), loop
                ).result()

        logger.info(
            f"Sentence-streaming TTS request: {request.input[:60]!r}"
        )
        gen_task = loop.run_in_executor(None, _generate_blocking)

        chunk_count = 0
        try:
            while True:
                kind, value = await queue.get()

                if kind == "done":
                    logger.info(
                        f"Sentence streaming complete. Chunks sent: {chunk_count}"
                    )
                    break

                if kind == "error":
                    logger.error(f"Streaming synthesis error: {value}")
                    yield struct.pack(">I", 0)  # error sentinel
                    return

                # Encode the sentence audio (1-D numpy array) to WAV bytes
                buf = io.BytesIO()
                sf.write(buf, value, model.sampling_rate, format="WAV")
                buf.seek(0)
                audio_bytes = buf.read()

                chunk_count += 1
                duration = len(value) / model.sampling_rate
                logger.info(
                    f"Sending sentence chunk {chunk_count}: "
                    f"{len(audio_bytes)} bytes, {duration:.2f}s"
                )
                yield struct.pack(">I", len(audio_bytes)) + audio_bytes

        finally:
            await gen_task

    return StreamingResponse(
        audio_stream_generator(),
        media_type="application/octet-stream",
        headers={"X-Sampling-Rate": str(model.sampling_rate)},
    )


@app.post("/v1/voices", response_model=VoiceProfile, status_code=201)
async def create_voice(request: CreateVoiceRequest):
    """Create a voice profile from reference audio.

    Args:
        request: Voice creation request with reference audio.

    Returns:
        Created voice profile.
    """
    model = get_model()

    if not model.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Check server logs.",
        )

    try:
        profile = model.voice_store.create_profile(
            name=request.name,
            ref_audio=request.audio,
            transcription=request.transcription,
            description=request.description,
            model=model._model,
        )
        return VoiceProfile(**profile)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Voice creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice creation failed: {str(e)}")


@app.get("/v1/voices", response_model=VoiceProfileList)
async def list_voices():
    """List all saved voice profiles.

    Returns:
        List of voice profiles.
    """
    model = get_model()
    voices = model.voice_store.list_profiles()
    return VoiceProfileList(voices=[VoiceProfile(**v) for v in voices])


@app.get("/v1/voices/{voice_id}", response_model=VoiceProfile)
async def get_voice(voice_id: str):
    """Get a specific voice profile by ID.

    Args:
        voice_id: Voice profile ID.

    Returns:
        Voice profile.
    """
    model = get_model()
    profile = model.voice_store.get_profile(voice_id)

    if profile is None:
        raise HTTPException(status_code=404, detail=f"Voice profile not found: {voice_id}")

    return VoiceProfile(**profile)


@app.delete("/v1/voices/{voice_id}", status_code=204)
async def delete_voice(voice_id: str):
    """Delete a voice profile.

    Args:
        voice_id: Voice profile ID.
    """
    model = get_model()
    deleted = model.voice_store.delete_profile(voice_id)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Voice profile not found: {voice_id}")


@app.get("/v1/languages")
async def list_languages():
    """List supported languages.

    Returns:
        Dictionary with language IDs and names.
    """
    model = get_model()
    return {
        "language_ids": model.supported_languages(),
        "language_names": model.supported_language_names(),
    }


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("OMNIVOICE_HOST", "0.0.0.0")
    port = int(os.environ.get("OMNIVOICE_PORT", "8000"))

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=os.environ.get("OMNIVOICE_RELOAD", "false").lower() == "true",
    )
