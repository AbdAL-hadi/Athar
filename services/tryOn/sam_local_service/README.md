# Athar Local SAM Service

This FastAPI service runs the SAM segmentation stage locally for the Athar glasses try-on pipeline.

## Endpoint

- `POST /segment`

## Expected request body

```json
{
  "image_data_url": "data:image/png;base64,...",
  "box": {
    "x": 123,
    "y": 45,
    "width": 200,
    "height": 90
  }
}
```

## Response shape

```json
{
  "maskBase64": "...",
  "maskDataUrl": "data:image/png;base64,...",
  "box": {
    "x": 123,
    "y": 45,
    "width": 200,
    "height": 90
  },
  "width": 1024,
  "height": 768,
  "model": "facebook/sam-vit-huge"
}
```

## Run locally

```bash
cd services/tryOn/sam_local_service
python -m pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8001
```

Make sure the Athar backend `.env` contains:

```env
SAM_LOCAL_SERVICE_URL=http://127.0.0.1:8001
SAM_MODEL_ID=facebook/sam-vit-huge
```
