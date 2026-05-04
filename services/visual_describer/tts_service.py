"""Local text-to-speech helpers for the AI visual describer service."""

from __future__ import annotations

from hashlib import sha1
from pathlib import Path
import re

from .config import VisualDescriberSettings


class TTSServiceError(RuntimeError):
    """Raised when local speech synthesis fails."""


def slugify_file_component(value: str) -> str:
    """Normalizes text into a filesystem-safe lowercase fragment."""

    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-") or "product"


def build_audio_output_path(
    *,
    settings: VisualDescriberSettings,
    product_id: str,
    language: str,
    detail_level: str,
    text: str,
) -> Path:
    """Creates a stable cache path for a spoken audio file based on the text payload."""

    file_hash = sha1(f"{language}:{detail_level}:{text}".encode("utf-8")).hexdigest()[:16]
    file_name = f"{slugify_file_component(product_id)}-{slugify_file_component(language)}-{slugify_file_component(detail_level)}-{file_hash}.wav"
    return settings.audio_dir / file_name


def _select_voice(engine, language: str, preferred_voice_id: str = ""):
    """Selects a system voice when possible, preferring an explicit voice id."""

    if preferred_voice_id:
        for voice in engine.getProperty("voices"):
            if voice.id == preferred_voice_id:
                return voice.id

    if language.lower().startswith("ar"):
        for voice in engine.getProperty("voices"):
            language_samples = getattr(voice, "languages", []) or []
            joined_languages = " ".join(str(value).lower() for value in language_samples)

            if "ar" in joined_languages or "arabic" in str(getattr(voice, "name", "")).lower():
                return voice.id

    return ""


def generate_speech(
    *,
    text: str,
    product_id: str,
    language: str,
    detail_level: str,
    settings: VisualDescriberSettings,
) -> dict[str, object]:
    """Generates or reuses a local WAV file for the supplied accessibility description."""

    if not str(text or "").strip():
        raise TTSServiceError("Text-to-speech requires non-empty text.")

    output_path = build_audio_output_path(
        settings=settings,
        product_id=product_id,
        language=language,
        detail_level=detail_level,
        text=text,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists():
        return {
            "audio_path": str(output_path),
            "audio_url": f"/uploads/audio-descriptions/{output_path.name}",
            "cached": True,
        }

    try:
        import pyttsx3
    except Exception as error:  # pragma: no cover - dependency availability varies
        raise TTSServiceError(
            "pyttsx3 is not available. Please install the visual describer Python requirements."
        ) from error

    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", settings.tts_rate)
        voice_id = _select_voice(engine, language, settings.tts_voice_id)

        if voice_id:
            engine.setProperty("voice", voice_id)

        engine.save_to_file(text, str(output_path))
        engine.runAndWait()
        engine.stop()
    except Exception as error:  # pragma: no cover - system TTS backends vary
        raise TTSServiceError("The local text-to-speech engine could not create the audio file.") from error

    return {
        "audio_path": str(output_path),
        "audio_url": f"/uploads/audio-descriptions/{output_path.name}",
        "cached": False,
    }
