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

## Customer chatbot environment

The customer chatbot route (`POST /api/chatbot/message`) reads Gemini credentials from backend environment variables only.

Required:

```bash
GEMINI_API_KEY=your_key_here
```

Optional model override:

```bash
GEMINI_CHATBOT_MODEL=gemini-2.5-flash
```

Fallback model behavior:

- if `GEMINI_CHATBOT_MODEL` is set, it is used
- otherwise `GEMINI_TEXT_MODEL` is used
- if neither is set, default is `gemini-2.5-flash`

Do not add any `VITE_GEMINI_API_KEY` frontend variable. Keep Gemini API keys on the backend only.

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

## Admin dashboard and Excel export

The storefront now includes a protected admin analytics route at `/admin/dashboard` for `admin` and `employee` sessions.

### What it adds

- Monthly KPI cards
- 7-day / 30-day sales chart
- Category revenue breakdown
- Top products table with stock badges
- Smart alerts panel
- One-click Excel export download

### Sales workbook

The backend generates `exports/sales_data.xlsx` with these sheets:

- `Orders`
- `Customers`
- `Products`
- `Summary`

The workbook is regenerated through a queued writer so concurrent confirmations do not corrupt the file.

### Automatic inventory + export sync

When an order moves to `Confirmed`, the backend now:

1. decreases product stock
2. updates stock flags and inventory status
3. logs stock movement
4. refreshes the sales workbook asynchronously

When an order is `Cancelled` or `Refunded`, stock is restored and the workbook is refreshed again.

### Local development run

Backend:

```bash
npm run server
```

Frontend:

```bash
npm run dev
```

### Access notes

- The new backend dashboard APIs live under `/api/admin`
- The Excel download endpoint is `/api/admin/dashboard/export`
- The existing auth middleware is reused; no separate auth system was added

## AI Visual Describer

Athar now includes a local accessibility feature for blind and low-vision shoppers. It can generate grounded visual descriptions from the main product image plus the product metadata, then synthesize audio locally so the description can be heard on the product page.

### What it does

- generates short and long English visual descriptions
- stores generated descriptions in MongoDB for reuse
- stores AI-derived style tags, occasion tags, dominant colors, visual traits, and semantic tags
- can generate spoken audio on demand and cache it under `uploads/audio-descriptions`
- marks descriptions as stale when core visual product data changes

### Local AI architecture

- **Vision model:** `Salesforce/blip-image-captioning-base`
- **Captioning runtime:** local Hugging Face Transformers in Python
- **TTS engine:** `pyttsx3` in Python
- **Node integration:** the Express backend calls the Python service over HTTP

### Python service files

The local service lives in:

- `services/visual_describer/app.py`
- `services/visual_describer/config.py`
- `services/visual_describer/schemas.py`
- `services/visual_describer/vision_service.py`
- `services/visual_describer/tts_service.py`
- `services/visual_describer/prompt_builder.py`
- `services/visual_describer/product_payload_normalizer.py`

### Install Python dependencies

```bash
cd services/visual_describer
python -m pip install -r requirements.txt
```

### Run the Python service

From the repo root:

```bash
python services/visual_describer/app.py
```

The local service listens on `http://127.0.0.1:8004` by default.

### Connect Node to the Python service

The Node backend uses `VISUAL_DESCRIBER_SERVICE_URL` and defaults to `http://127.0.0.1:8004`.

### Product routes

- `GET /api/products/:id/visual-description`
- `POST /api/products/:id/generate-visual-description`
- `POST /api/products/:id/generate-visual-audio`
- `POST /api/products/generate-visual-descriptions/batch`

### How to generate descriptions

For one product:

```bash
curl -X POST http://localhost:5000/api/products/<product-id>/generate-visual-description ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <ADMIN_OR_EMPLOYEE_TOKEN>" ^
  -d "{\"force\":true}"
```

For batch generation:

```bash
curl -X POST http://localhost:5000/api/products/generate-visual-descriptions/batch ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <ADMIN_OR_EMPLOYEE_TOKEN>" ^
  -d "{\"limit\":10}"
```

### Local TTS

The product page can request short or long spoken descriptions. Audio is generated on demand through the Python service and then served back from:

- `/uploads/audio-descriptions/...`

If `pyttsx3` is not installed or the local system voice engine is unavailable, the route returns a clean error instead of breaking the product page.

### Tests

Node-side helper tests:

```bash
node tests/visualDescriber.test.js
```

Python-side tests:

```bash
pytest services/visual_describer/test_visual_describer.py
```

## AI-assisted comment moderation

Product comments are moderated by the backend before they are public. Athar uses a free local/open-source stack:

- `@xenova/transformers`
- default model: `Xenova/toxic-bert`
- local rule fallback for Arabic/English blocked terms, suspicious repetition, and spam patterns

No paid moderation API is used. The first AI moderation request can take longer while the model loads or downloads into the local Transformers.js cache. If the model is unavailable, the backend falls back to the local rule checks and keeps suspicious comments pending for admin review.

### Comment endpoints

- `POST /api/comments`
- `GET /api/comments/product/:productId`
- `GET /api/admin/comments/moderation`
- `PATCH /api/admin/comments/:commentId/status`

### Decisions

- score `80+`: rejected, hidden publicly, and a rejection email is attempted
- score `40-79`: pending, hidden publicly until admin review
- score below `40`: approved and public

### Safe local test words

Use these harmless tokens to test moderation without typing real offensive language:

- rejected: `athar_badword_test`
- pending: `athar_spam_test`
- threat rejection: `athar_threat_test`

### Environment

```bash
TOXICITY_MODEL_ID=Xenova/toxic-bert
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=Athar <your@email.com>
SMTP_FROM=Athar <your@email.com>
```
