"""Normalization helpers for product payloads sent to the visual describer."""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen


class ProductPayloadError(ValueError):
    """Raised when the incoming product payload is incomplete or unusable."""


def normalize_text(value: object) -> str:
    """Normalizes arbitrary values into trimmed strings."""

    return str(value or "").strip()


def normalize_product_payload(payload: dict[str, object]) -> dict[str, str]:
    """Returns a clean product payload ready for prompt construction and inference."""

    normalized_payload = {
        "product_id": normalize_text(payload.get("product_id")),
        "slug": normalize_text(payload.get("slug")),
        "title": normalize_text(payload.get("title")),
        "description": normalize_text(payload.get("description")),
        "category": normalize_text(payload.get("category")),
        "material": normalize_text(payload.get("material")),
        "image_path": normalize_text(payload.get("image_path")),
        "image_url": normalize_text(payload.get("image_url")),
        "image_data_url": normalize_text(payload.get("image_data_url")),
    }

    if not normalized_payload["title"]:
        raise ProductPayloadError("The product title is required for visual description generation.")

    if not (
        normalized_payload["image_path"]
        or normalized_payload["image_url"]
        or normalized_payload["image_data_url"]
    ):
        raise ProductPayloadError("The product payload must include a usable image path, URL, or data URL.")

    return normalized_payload


def load_product_image(normalized_payload: dict[str, str]):
    """Loads the product image from a local path, URL, or data URL into a PIL image."""

    from PIL import Image

    if normalized_payload["image_path"]:
        image_path = Path(normalized_payload["image_path"]).expanduser().resolve()

        if not image_path.exists():
            raise ProductPayloadError(f"Image path does not exist: {image_path}")

        return Image.open(image_path).convert("RGB")

    if normalized_payload["image_data_url"]:
        _, encoded_payload = normalized_payload["image_data_url"].split(",", 1)
        image_bytes = base64.b64decode(encoded_payload)
        return Image.open(BytesIO(image_bytes)).convert("RGB")

    if normalized_payload["image_url"]:
        with urlopen(normalized_payload["image_url"]) as response:  # nosec - local dev helper
            return Image.open(BytesIO(response.read())).convert("RGB")

    raise ProductPayloadError("Unable to load a product image from the supplied payload.")
