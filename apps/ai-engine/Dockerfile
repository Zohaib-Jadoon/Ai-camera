FROM python:3.12-slim

WORKDIR /app

# System deps for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ffmpeg build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY apps/ai-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai-engine/src ./src
RUN useradd --create-home engine && chown -R engine:engine /app
USER engine

EXPOSE 8000

CMD ["python", "-m", "src.launcher"]
