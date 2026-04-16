---
title: Athar Grounding DINO
emoji: 👓
colorFrom: pink
colorTo: amber
sdk: gradio
sdk_version: 5.25.0
app_file: app.py
pinned: false
---

# Athar Grounding DINO Space

This is the free Gradio Space companion for the Athar glasses try-on backend.

## What it does

- receives an image as a data URL string
- receives a labels string such as `glasses, sunglasses, eyewear`
- runs Grounding DINO through the Hugging Face `transformers` zero-shot object detection pipeline
- returns normalized bounding boxes for the Athar backend

## Recommended Hugging Face Space settings

- **SDK**: Gradio
- **Hardware**: Free CPU is enough for the first validation pass
- **Environment variable**:

```env
GROUNDING_DINO_MODEL_ID=IDEA-Research/grounding-dino-tiny
```

`grounding-dino-tiny` is the recommended default for the free CPU validation pass because it is lighter than the base checkpoint.

## Files to upload

- `app.py`
- `requirements.txt`

## After deployment

Use either of these in Athar's backend `.env`:

```env
GROUNDING_DINO_ENDPOINT_URL=https://huggingface.co/spaces/<user>/<space>
```

or:

```env
GROUNDING_DINO_ENDPOINT_URL=https://<user>-<space>.hf.space
```

Athar will call the Space via the Gradio queue API on `/gradio_api/call/predict`.
