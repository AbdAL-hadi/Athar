FROM node:20-bookworm-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    python-is-python3 \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/tryOn/requirements.face-landmarks.txt /tmp/requirements.face-landmarks.txt
RUN python -m venv "$VIRTUAL_ENV" \
  && pip install --no-cache-dir -r /tmp/requirements.face-landmarks.txt

COPY . .

RUN mkdir -p /app/generated/try-on

EXPOSE 5000

CMD ["npm", "run", "server"]
