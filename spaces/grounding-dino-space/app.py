import base64
import io
import os
import re
from functools import lru_cache

import gradio as gr
from PIL import Image
from transformers import pipeline


MODEL_ID = os.getenv("GROUNDING_DINO_MODEL_ID", "IDEA-Research/grounding-dino-tiny")
MAX_IMAGE_DIMENSION = int(os.getenv("GROUNDING_DINO_MAX_IMAGE_DIMENSION", "1280"))
DEFAULT_LABELS = ["glasses", "sunglasses", "eyewear"]


@lru_cache(maxsize=1)
def get_detector():
    try:
        return pipeline(
            task="zero-shot-object-detection",
            model=MODEL_ID,
            device=-1,
        )
    except Exception as error:
        raise gr.Error(f"Could not load Grounding DINO model '{MODEL_ID}': {error}") from error


def decode_image_data(image_data_url: str) -> Image.Image:
    if not image_data_url:
        raise gr.Error("Please provide an image data URL.")

    if image_data_url.startswith("data:"):
        _, encoded_content = image_data_url.split(",", 1)
        image_bytes = base64.b64decode(encoded_content)
    else:
        image_bytes = base64.b64decode(image_data_url)

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    max_side = max(image.size)

    if max_side > MAX_IMAGE_DIMENSION:
        resize_ratio = MAX_IMAGE_DIMENSION / max_side
        resized_width = max(1, int(image.width * resize_ratio))
        resized_height = max(1, int(image.height * resize_ratio))
        image = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    return image


def parse_labels(raw_labels: str):
    if not raw_labels:
        return DEFAULT_LABELS

    labels = [
        label.strip()
        for label in re.split(r"[\n,.;]+", raw_labels)
        if label.strip()
    ]

    return labels or DEFAULT_LABELS


def normalize_prediction(prediction):
    box = prediction.get("box", {})
    xmin = float(box.get("xmin", 0))
    ymin = float(box.get("ymin", 0))
    xmax = float(box.get("xmax", xmin))
    ymax = float(box.get("ymax", ymin))

    return {
        "x": xmin,
        "y": ymin,
        "width": max(0.0, xmax - xmin),
        "height": max(0.0, ymax - ymin),
        "score": float(prediction.get("score", 0)),
        "label": str(prediction.get("label", "glasses")),
    }


def predict(image_data_url: str, labels_text: str):
    try:
        image = decode_image_data(image_data_url)
        labels = parse_labels(labels_text)
        detector = get_detector()
        predictions = detector(image, candidate_labels=labels)
        boxes = [normalize_prediction(prediction) for prediction in predictions]

        return {
            "boxes": boxes,
            "labels": labels,
            "model_id": MODEL_ID,
        }
    except gr.Error:
        raise
    except Exception as error:
        raise gr.Error(f"Grounding DINO prediction failed: {error}") from error


with gr.Blocks(title="Athar Grounding DINO") as demo:
    gr.Markdown(
        """
        # Athar Grounding DINO Space
        Upload-free API for the Athar glasses try-on backend.
        This Space expects:
        1. an image data URL string
        2. a labels string such as `glasses, sunglasses, eyewear`
        """
    )

    image_data_input = gr.Textbox(label="Image data URL", lines=6)
    labels_input = gr.Textbox(
        label="Candidate labels",
        value="glasses, sunglasses, eyewear",
    )
    output = gr.JSON(label="Detections")
    submit = gr.Button("Predict")

    submit.click(
        fn=predict,
        inputs=[image_data_input, labels_input],
        outputs=output,
        api_name="/predict",
    )


if __name__ == "__main__":
    demo.launch()
