"""Unit tests for the local AI visual describer helpers."""

from __future__ import annotations

from pathlib import Path

import pytest

from services.visual_describer.config import load_settings
from services.visual_describer.product_payload_normalizer import (
    ProductPayloadError,
    normalize_product_payload,
)
from services.visual_describer.prompt_builder import build_grounded_visual_description
from services.visual_describer.tts_service import build_audio_output_path


def test_prompt_builder_produces_accessibility_friendly_shapes():
    """The prompt builder should always return the expected accessible fields."""

    result = build_grounded_visual_description(
        title="Peacock Eye Wallet",
        category="Wallets",
        material="Engraved black leather",
        description="A refined leather wallet carrying the Peacock Eye motif.",
        caption="a black wallet with engraved motif details",
        dominant_colors=["black", "gold"],
    )

    assert result["descriptions"]["en"]["short"]
    assert result["descriptions"]["en"]["long"]
    assert len(result["visualTraits"]) == 3
    assert "styleTags" in result
    assert "semanticTags" in result


def test_product_payload_requires_image_source():
    """The normalizer should fail cleanly when no image source is supplied."""

    with pytest.raises(ProductPayloadError):
        normalize_product_payload(
            {
                "title": "Wallet without image",
            }
        )


def test_product_payload_keeps_facts_clean():
    """The normalizer should preserve title and metadata while trimming whitespace."""

    normalized = normalize_product_payload(
        {
            "title": "  Desert Carryall  ",
            "description": "  A neutral carryall. ",
            "category": " Bags ",
            "material": " Structured leather ",
            "image_path": "C:/temp/example.png",
        }
    )

    assert normalized["title"] == "Desert Carryall"
    assert normalized["category"] == "Bags"
    assert normalized["material"] == "Structured leather"


def test_tts_output_path_is_stable_and_cached():
    """Audio file generation should use deterministic cache-friendly filenames."""

    settings = load_settings()
    audio_path = build_audio_output_path(
        settings=settings,
        product_id="athar-gaza-rose-handbag",
        language="en",
        detail_level="short",
        text="A structured blush-toned handbag with refined details.",
    )

    assert audio_path.suffix == ".wav"
    assert audio_path.parent == Path(settings.audio_dir)
    assert "athar-gaza-rose-handbag" in audio_path.name
