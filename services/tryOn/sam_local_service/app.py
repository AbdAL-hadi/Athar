import base64
import io
import os
from functools import lru_cache

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image
from transformers import SamModel, SamProcessor


SAM_MODEL_ID = os.getenv("SAM_MODEL_ID", "facebook/sam-vit-huge")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class BoxPayload(BaseModel):
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)


class SegmentRequest(BaseModel):
    image_data_url: str
    box: BoxPayload


app = FastAPI(title="Athar Local SAM Service")


@lru_cache(maxsize=1)
def get_sam_components():
    processor = SamProcessor.from_pretrained(SAM_MODEL_ID)
    model = SamModel.from_pretrained(SAM_MODEL_ID)
    model.to(DEVICE)
    model.eval()
    return processor, model


def decode_data_url(image_data_url: str) -> Image.Image:
    if not image_data_url:
        raise HTTPException(status_code=400, detail="image_data_url is required.")

    if image_data_url.startswith("data:"):
        _, encoded = image_data_url.split(",", 1)
    else:
        encoded = image_data_url

    try:
        image_bytes = base64.b64decode(encoded)
    except Exception as error:
        raise HTTPException(status_code=400, detail="image_data_url is not valid base64.") from error

    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as error:
        raise HTTPException(status_code=400, detail="Could not read the source image for SAM.") from error


def mask_to_base64(mask_array: np.ndarray) -> str:
    mask_image = Image.fromarray(mask_array.astype(np.uint8) * 255, mode="L")
    buffer = io.BytesIO()
    mask_image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def pick_2d_mask(post_processed_masks) -> np.ndarray:
    if not post_processed_masks:
        raise HTTPException(status_code=422, detail="Local SAM did not return any masks.")

    mask_array = np.asarray(post_processed_masks[0])
    mask_array = np.squeeze(mask_array)

    if mask_array.ndim != 2:
        raise HTTPException(status_code=422, detail="Local SAM returned an unexpected mask shape.")

    return mask_array > 0


@app.get("/health")
def health():
    return {"success": True, "model": SAM_MODEL_ID, "device": DEVICE}


@app.post("/segment")
def segment(request: SegmentRequest):
    image = decode_data_url(request.image_data_url)
    processor, model = get_sam_components()

    x1 = request.box.x
    y1 = request.box.y
    x2 = request.box.x + request.box.width
    y2 = request.box.y + request.box.height

    try:
        inputs = processor(
            images=image,
            input_boxes=[[[x1, y1, x2, y2]]],
            return_tensors="pt",
        )
        inputs = {key: value.to(DEVICE) if hasattr(value, "to") else value for key, value in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs, multimask_output=False)

        masks = processor.image_processor.post_process_masks(
            outputs.pred_masks.cpu(),
            inputs["original_sizes"].cpu(),
            inputs["reshaped_input_sizes"].cpu(),
        )
        binary_mask = pick_2d_mask(masks)
        mask_base64 = mask_to_base64(binary_mask)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Local SAM segmentation failed: {error}") from error

    return {
        "maskBase64": mask_base64,
        "maskDataUrl": f"data:image/png;base64,{mask_base64}",
        "box": request.box.model_dump(),
        "width": image.width,
        "height": image.height,
        "model": SAM_MODEL_ID,
    }
