FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY services/tryOn/sam_local_service/requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY services/tryOn/sam_local_service/ ./

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
