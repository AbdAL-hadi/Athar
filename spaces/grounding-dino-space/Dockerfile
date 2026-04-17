FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV GRADIO_SERVER_NAME=0.0.0.0
ENV GRADIO_SERVER_PORT=7860

COPY spaces/grounding-dino-space/requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY spaces/grounding-dino-space/ ./

EXPOSE 7860

CMD ["python", "app.py"]
