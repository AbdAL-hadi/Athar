# Athar Local RMBG Service

This FastAPI service runs the RMBG-2.0 mask refinement stage locally for the Athar glasses try-on pipeline.

## Endpoint

- `POST /refine-mask`

## Expected request body

```json
{
  "image_data_url": "data:image/png;base64,...",
  "mask_data_url": "data:image/png;base64,..."
}
```

## Response shape

```json
{
  "mask_data_url": "data:image/png;base64,...",
  "model": "briaai/RMBG-2.0"
}
```

## Run locally

```bash
cd services/tryOn/rmbg_local_service
python -m pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8002
```

Make sure the Athar backend `.env` contains:

```env
MASK_REFINEMENT_LOCAL_SERVICE_URL=http://127.0.0.1:8002
MASK_REFINEMENT_MODEL_ID=briaai/RMBG-2.0
```
