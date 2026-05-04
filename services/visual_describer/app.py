"""FastAPI application for local image description and speech synthesis."""

from __future__ import annotations

from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi import FastAPI, HTTPException
import uvicorn

from services.visual_describer.config import load_settings
from services.visual_describer.schemas import (
    DescribeRequest,
    DescribeResponse,
    SpeakRequest,
    SpeakResponse,
)
from services.visual_describer.tts_service import generate_speech, TTSServiceError
from services.visual_describer.vision_service import (
    generate_product_visual_description,
    VisionServiceError,
)


settings = load_settings()
app = FastAPI(title="Athar AI Visual Describer", version="1.0.0")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    """Returns a simple readiness response."""

    return {"status": "ok"}


@app.post("/describe", response_model=DescribeResponse)
def describe_product(payload: DescribeRequest) -> DescribeResponse:
    """Generates a grounded visual description using a local captioning model and heuristics."""

    try:
        generated_description = generate_product_visual_description(payload.model_dump(), settings)
        return DescribeResponse(**generated_description)
    except VisionServiceError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/speak", response_model=SpeakResponse)
def speak_description(payload: SpeakRequest) -> SpeakResponse:
    """Creates or reuses a local audio file for an accessibility description."""

    try:
        generated_audio = generate_speech(
            text=payload.text,
            product_id=payload.product_id,
            language=payload.language,
            detail_level=payload.detail_level,
            settings=settings,
        )
        return SpeakResponse(**generated_audio)
    except TTSServiceError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


if __name__ == "__main__":
    uvicorn.run("services.visual_describer.app:app", host=settings.host, port=settings.port, reload=False)
