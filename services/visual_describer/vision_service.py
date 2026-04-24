"""Local image understanding service backed by a lightweight open-source captioning model."""

from __future__ import annotations

from functools import lru_cache
import math
from pathlib import Path

from .config import VisualDescriberSettings
from .product_payload_normalizer import load_product_image, normalize_product_payload
from .prompt_builder import build_grounded_visual_description


COMMON_COLOR_PALETTE = {
    "black": (30, 30, 30),
    "white": (240, 240, 240),
    "ivory": (245, 236, 210),
    "beige": (220, 198, 163),
    "cream": (244, 230, 205),
    "brown": (128, 86, 52),
    "tan": (189, 152, 109),
    "gold": (195, 153, 66),
    "silver": (170, 170, 175),
    "rose gold": (196, 145, 130),
    "pink": (220, 173, 176),
    "red": (156, 60, 66),
    "blue": (92, 118, 160),
    "green": (95, 130, 92),
    "gray": (150, 150, 150),
}


class VisionServiceError(RuntimeError):
    """Raised when the local captioning model or image processing fails."""


def _get_snapshot_cache_path(model_id: str) -> Path:
    """Builds the default Hugging Face snapshot cache path for a local model id."""

    model_cache_root = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_id.replace('/', '--')}" / "snapshots"

    if not model_cache_root.exists():
        return Path()

    snapshots = sorted((path for path in model_cache_root.iterdir() if path.is_dir()), key=lambda item: item.name, reverse=True)
    return snapshots[0] if snapshots else Path()


def _resolve_local_model_path(model_id: str) -> str:
    """Returns a local model path when the full captioning model is cached locally."""

    snapshot_path = _get_snapshot_cache_path(model_id)

    if not snapshot_path:
        return model_id

    has_config = (snapshot_path / "config.json").exists()
    has_weights = any(
        (snapshot_path / candidate_name).exists()
        for candidate_name in ("model.safetensors", "pytorch_model.bin")
    )

    if has_config and has_weights:
        return str(snapshot_path)

    return model_id


def _has_model_weights(snapshot_path: Path) -> bool:
    """Checks whether a Hugging Face snapshot contains actual model weights."""

    return any(
        (snapshot_path / candidate_name).exists()
        for candidate_name in ("model.safetensors", "pytorch_model.bin")
    )


def _euclidean_distance(source: tuple[int, int, int], target: tuple[int, int, int]) -> float:
    """Computes simple RGB distance for approximate human-friendly color naming."""

    return math.sqrt(sum((source[index] - target[index]) ** 2 for index in range(3)))


def _closest_color_name(rgb: tuple[int, int, int]) -> str:
    """Maps an RGB tuple to the closest semantic color label in a small palette."""

    return min(COMMON_COLOR_PALETTE, key=lambda color_name: _euclidean_distance(rgb, COMMON_COLOR_PALETTE[color_name]))


def extract_dominant_colors(image) -> list[str]:
    """Extracts a few dominant color names from a PIL image using quantization."""

    quantized = image.copy()
    quantized.thumbnail((160, 160))
    quantized = quantized.quantize(colors=5).convert("RGB")
    color_counts = quantized.getcolors(quantized.width * quantized.height) or []
    ordered_colors = sorted(color_counts, key=lambda item: item[0], reverse=True)
    resolved_colors = []

    for _count, rgb in ordered_colors:
        color_name = _closest_color_name(rgb)

        if color_name not in resolved_colors:
            resolved_colors.append(color_name)

    return resolved_colors[:5] or ["beige"]


@lru_cache(maxsize=1)
def _load_caption_components(model_id: str, device: int):
    """Loads the BLIP processor and model lazily for local caption generation."""

    try:
        import torch
        from transformers import BlipForConditionalGeneration, BlipProcessor
    except Exception as error:  # pragma: no cover - import failure is environment-specific
        raise VisionServiceError(
            "Transformers is not available. Please install the visual describer Python requirements."
        ) from error

    resolved_model_reference = _resolve_local_model_path(model_id)
    local_files_only = bool(resolved_model_reference != model_id)

    try:
        processor = BlipProcessor.from_pretrained(
            resolved_model_reference,
            local_files_only=local_files_only,
        )
        model = BlipForConditionalGeneration.from_pretrained(
            resolved_model_reference,
            local_files_only=local_files_only,
        )
        target_device = "cpu" if device < 0 or not torch.cuda.is_available() else f"cuda:{device}"
        model.to(target_device)
        model.eval()
        return processor, model, target_device
    except Exception as error:  # pragma: no cover - model load depends on local environment
        snapshot_path = _get_snapshot_cache_path(model_id)
        has_partial_cache = bool(snapshot_path and (snapshot_path / "config.json").exists())

        if has_partial_cache:
            if _has_model_weights(snapshot_path):
                raise VisionServiceError(
                    f"The local captioning model '{model_id}' exists, but could not be initialized on this machine. "
                    "Please restart the Python service and verify your local Transformers and Torch installation."
                ) from error

            raise VisionServiceError(
                f"The local captioning model '{model_id}' is only partially cached on this machine. "
                "The config file exists, but the model weights are missing. Connect to the internet once to download the full model, then restart the Python visual describer service."
            ) from error

        raise VisionServiceError(
            f"Failed to load the local captioning model '{model_id}'. Download it locally first, then restart the Python visual describer service."
        ) from error


def generate_product_visual_description(payload: dict[str, object], settings: VisualDescriberSettings) -> dict[str, object]:
    """Runs local captioning and deterministic grounding to produce useful store-safe descriptions."""

    normalized_payload = normalize_product_payload(payload)

    try:
        image = load_product_image(normalized_payload)
    except Exception as error:
        raise VisionServiceError(str(error)) from error

    processor, model, target_device = _load_caption_components(settings.model_id, settings.device)

    try:
        model_inputs = processor(images=image, return_tensors="pt")
        model_inputs = {
            input_name: input_tensor.to(target_device)
            for input_name, input_tensor in model_inputs.items()
        }
        generated_tokens = model.generate(**model_inputs, max_new_tokens=settings.max_new_tokens)
        caption = processor.decode(generated_tokens[0], skip_special_tokens=True).strip()
    except Exception as error:  # pragma: no cover - depends on model runtime
        raise VisionServiceError("The local vision model could not generate a caption for this product image.") from error

    if not caption:
        caption = "A product photo with a refined accessory presentation."

    dominant_colors = extract_dominant_colors(image)
    grounded_output = build_grounded_visual_description(
        title=normalized_payload["title"],
        category=normalized_payload["category"],
        material=normalized_payload["material"],
        description=normalized_payload["description"],
        caption=caption,
        dominant_colors=dominant_colors,
    )

    grounded_output["caption"] = caption
    grounded_output["model"] = settings.model_id
    return grounded_output
