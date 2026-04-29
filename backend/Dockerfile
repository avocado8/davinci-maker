FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV U2NET_HOME=/app/.u2net
RUN python -u -c "import traceback; from rembg.sessions.u2net import U2netSession; print('Downloading rembg u2net model to', U2netSession.u2net_home(), flush=True); U2netSession.download_models(); print('Downloaded rembg u2net model', flush=True)"

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
