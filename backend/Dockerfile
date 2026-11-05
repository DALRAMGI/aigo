FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
# CPU 전용 torch (GPU 빌드보다 이미지가 훨씬 작다)
RUN uv pip install --system torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY pyproject.toml ./
RUN uv pip install --system -r pyproject.toml
COPY app ./app
CMD ["sh", "-c", "uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}"]
