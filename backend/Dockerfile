FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.14 /uv /usr/local/bin/uv
WORKDIR /app
# uv.lock 기준으로 설치한다. torch는 Task 7에서 pyproject의 [tool.uv.sources]에
# CPU 전용 인덱스(download.pytorch.org/whl/cpu)로 지정해 추가하면 이 단계에서 같이 잠긴다.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
ENV PATH="/app/.venv/bin:$PATH"
COPY app ./app
CMD ["sh", "-c", "uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}"]
