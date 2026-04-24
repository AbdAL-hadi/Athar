# Athar AI Visual Describer Service

This local FastAPI service powers accessibility-focused product descriptions and speech for Athar.

## What it does

- loads a local open-source image captioning model
- combines image understanding with existing product metadata
- generates short and long visual descriptions
- derives style tags, occasion tags, colors, visual traits, and semantic tags
- synthesizes local audio with `pyttsx3`

## Install

```bash
cd services/visual_describer
python -m pip install -r requirements.txt
```

## Run

```bash
python app.py
```

The service listens on `http://127.0.0.1:8004` by default.

## Endpoints

- `POST /describe`
- `POST /speak`
- `GET /health`
