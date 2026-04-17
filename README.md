# Athar Docker Setup

This repo now includes Docker support for the main storefront stack and the optional AI try-on services.

## What runs in Docker

- `frontend`: Vite app built and served by Nginx on `http://localhost:5173`
- `backend`: Express API on `http://localhost:5000`
- `mongo`: MongoDB on `mongodb://localhost:27017`
- `grounding-dino`: local Gradio service for glasses detection on `http://localhost:7860` (`ai` profile)
- `sam-service`: local SAM segmentation service on `http://localhost:8001` (`ai` profile)
- `rmbg-service`: local mask refinement service on `http://localhost:8002` (`ai` profile)

## Quick start

The core storefront stack:

```bash
docker compose up --build
```

The full stack including the AI services:

```bash
docker compose --profile ai up --build
```

You can also use:

```bash
npm run docker:up
npm run docker:up:ai
```

## Docker environment overrides

Compose uses safe defaults, so it can start without extra files for the basic storefront.

If you want to override ports, API URLs, email settings, or AI settings, use `.env.docker.example` as the template for a local `.env.docker` file and start Compose with:

```bash
docker compose --env-file .env.docker --profile ai up --build
```

## Important note for the AI try-on flow

The local Docker stack now covers:

- Grounding DINO detection
- local SAM segmentation
- local RMBG refinement
- internal MediaPipe face landmarks inside the backend container

The final blending stage still calls Hugging Face Inference for `FLUX.1-Fill-dev`, so the try-on flow needs `DOCKER_HUGGING_FACE_API_TOKEN` if you want that route to finish successfully.

## Stopping the stack

```bash
docker compose down
```
