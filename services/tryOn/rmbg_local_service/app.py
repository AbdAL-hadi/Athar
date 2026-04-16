import base64
import io
import os
from functools import lru_cache

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel
from transformers import AutoImageProcessor, AutoModelForImageSegmentation


RMBG_MODEL_ID = os.getenv("MASK_REFINEMENT_MODEL_ID", "briaai/RMBG-1.4")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class RefineMaskRequest(BaseModel):
    image_data_url: str
    mask_data_url: str | None = None


app = FastAPI(title="Athar Local RMBG Service")


@lru_cache(maxsize=1)
def get_rmbg_components():
    print(f"Loading RMBG model: {RMBG_MODEL_ID} on {DEVICE}")

    processor = AutoImageProcessor.from_pretrained(
        RMBG_MODEL_ID,
        trust_remote_code=True,
    )
    model = AutoModelForImageSegmentation.from_pretrained(
        RMBG_MODEL_ID,
        trust_remote_code=True,
    )
    model.to(DEVICE)
    model.eval()
    return processor, model


def decode_data_url(image_data_url: str, field_name: str) -> Image.Image:
    if not image_data_url:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")

    if image_data_url.startswith("data:"):
        _, encoded = image_data_url.split(",", 1)
    else:
        encoded = image_data_url

    try:
        image_bytes = base64.b64decode(encoded)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"{field_name} is not valid base64.") from error

    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Could not read {field_name}.") from error


def build_mask_image(mask_array: np.ndarray, size: tuple[int, int]) -> Image.Image:
    clipped_mask = np.clip(mask_array, 0, 1)
    mask_image = Image.fromarray((clipped_mask * 255).astype(np.uint8), mode="L")
    return mask_image.resize(size, Image.Resampling.LANCZOS)


def cutout_to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


@app.get("/health")
def health():
    return {"success": True, "model": RMBG_MODEL_ID, "device": DEVICE}


@app.post("/refine-mask")
def refine_mask(request: RefineMaskRequest):
    source_image = decode_data_url(request.image_data_url, "image_data_url")
    input_mask = (
        decode_data_url(request.mask_data_url, "mask_data_url").convert("L")
        if request.mask_data_url
        else None
    )

    original_size = source_image.size
    rgb_image = source_image.convert("RGB")
    processor, model = get_rmbg_components()

    try:
        inputs = processor(images=rgb_image, return_tensors="pt")
        inputs = {
            key: value.to(DEVICE) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }

        with torch.no_grad():
            outputs = model(**inputs)

        logits = outputs.logits if hasattr(outputs, "logits") else outputs[0]
        mask_tensor = logits[-1] if logits.ndim == 4 else logits
        mask_tensor = torch.sigmoid(mask_tensor)
        mask_array = mask_tensor[0].detach().cpu().squeeze().float().numpy()

        refined_mask = build_mask_image(mask_array, original_size)

        if input_mask is not None:
            refined_mask = Image.fromarray(
                np.minimum(
                    np.asarray(refined_mask, dtype=np.uint8),
                    np.asarray(
                        input_mask.resize(original_size, Image.Resampling.LANCZOS),
                        dtype=np.uint8,
                    ),
                ),
                mode="L",
            )

        cutout = source_image.copy()
        cutout.putalpha(refined_mask)

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Local RMBG refinement failed: {error}") from error

    return {
        "mask_data_url": cutout_to_data_url(cutout),
        "model": RMBG_MODEL_ID,
    }