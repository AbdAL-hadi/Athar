"""Configuration helpers for the local AI visual describer service."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(slots=True)
class VisualDescriberSettings:
    """Runtime settings for the local visual describer service."""

    model_id: str
    host: str
    port: int
    device: int
    max_new_tokens: int
    audio_dir: Path
    tts_rate: int
    tts_voice_id: str


def load_settings() -> VisualDescriberSettings:
    """Loads service settings from the environment with safe local defaults."""

    return VisualDescriberSettings(
        model_id=os.getenv("VISUAL_DESCRIBER_MODEL_ID", "Salesforce/blip-image-captioning-base").strip()
        or "Salesforce/blip-image-captioning-base",
        host=os.getenv("VISUAL_DESCRIBER_HOST", "127.0.0.1").strip() or "127.0.0.1",
        port=int(os.getenv("VISUAL_DESCRIBER_PORT", "8004")),
        device=int(os.getenv("VISUAL_DESCRIBER_DEVICE", "-1")),
        max_new_tokens=int(os.getenv("VISUAL_DESCRIBER_MAX_NEW_TOKENS", "40")),
        audio_dir=Path(os.getenv("VISUAL_DESCRIBER_AUDIO_DIR", str(REPO_ROOT / "uploads" / "audio-descriptions"))),
        tts_rate=int(os.getenv("VISUAL_DESCRIBER_TTS_RATE", "170")),
        tts_voice_id=os.getenv("VISUAL_DESCRIBER_TTS_VOICE_ID", "").strip(),
    )
